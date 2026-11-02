---
description: Audit a freshly-cloned open-source repository for malicious/suspicious code, secrets, vulnerable dependencies, license risk, and supply-chain red flags BEFORE it is trusted, installed, or run. Static/read-only first — never executes the target repo's install or build scripts as part of the scan; covers both install-time (postinstall) and import-time (require/load) attack vectors. Use right after `git clone`-ing any third-party repo, before `npm install`/`pip install`/`make`/`docker build`.
---

# /repo-scan — OSS Repository Security & Code Audit (Pre-Trust Scan)

> **Trigger**: User just cloned (or is about to use) a third-party/open-source repo and wants a security + code audit before trusting it — before install, build, or execution.
> **Output**: A single risk report (🟢/🟡/🔴) with a findings table, an explicit "what runs automatically" callout (install-time AND import-time), and a safe-install recipe if the user decides to proceed. No repo code is executed as part of the scan itself.

> **Why this matters (2025–2026 threat context):** ~455,000 malicious OSS packages were published in 2025 alone (cumulative >1.23M blocked, +75% YoY). Nearly every major 2026 campaign (Shai-Hulud worm, Mastra, typosquat credential stealers) fired from a **`postinstall`/`preinstall` lifecycle hook the moment `npm install` ran**, and a newer class (e.g. the AsyncAPI compromise) fires at **module-load / import time** instead. Malicious versions are usually pulled from the registry within 2–12 hours — so scanning *before* installing, and never running install scripts blind, is the single highest-leverage defense.

---

## 0. Ground Rules (read first — non-negotiable)

1. **Never run the target repo's install/build/run commands as part of the scan** — `npm install`, `yarn`, `pnpm install`, `pip install -r requirements.txt`, `pip install .`, `make`, `./configure`, `cargo build`, `docker build`, `docker compose up`, `npx <repo-tool>`. These are exactly where install-time payloads fire.
2. **Static-and-read-only first.** Allowed: file listing, `grep`, manifest/lockfile parsing, and trusted *third-party scanner* CLIs (Section 1.1). Installing a scanner is fine; running the *target repo's own* code is not.
3. **`git clone` is safe by itself** (no code execution) — but do NOT open the repo in an editor with auto-run tasks/extensions, and check `git config --local --get core.hooksPath` isn't repointed to a repo-shipped hooks dir before you touch it.
4. **Stop-on-High.** If Sections 2–4 surface a **🔴 High** finding (verified secret, obvious payload, known-malicious dependency), stop and report immediately — do not keep scanning to "finish" a repo that already shows signs of compromise.
5. **Prefer sandbox for anything dynamic.** If the user insists on actually running the repo, do it in a throwaway container/VM with no real credentials mounted — never on a host with live secrets, cloud tokens, or SSH keys present.

---

## 1. Identify Stack + Surface

Map what's actually in the repo — this decides which tools and checks apply.

```bash
# Ecosystem manifests + lockfiles present?
ls package.json package-lock.json pnpm-lock.yaml yarn.lock requirements.txt pyproject.toml Pipfile.lock \
   go.mod go.sum Cargo.toml Cargo.lock composer.json composer.lock Gemfile.lock pom.xml build.gradle 2>/dev/null

# Build/CI/execution surface (extra places code runs automatically)
ls Dockerfile docker-compose*.yml Makefile .github/workflows/ .gitlab-ci.yml Jenkinsfile 2>/dev/null

# Repo scale + freshness + authorship signals
git log --oneline | wc -l
git log -1 --format='%ci %an <%ae>'
git shortlog -sne | head -10
```

Record: primary language(s), package manager(s), presence of Dockerfile/CI (extra execution surface), commit count, last-commit date, top contributors. A repo claiming 40k stars but showing 1 commit from 3 days ago is itself a red flag.

### 1.1 Preferred Tool Ladder (install the scanner, not the repo)

Use the best tool available; fall back to grep only when none is installed. All are read-only against the target.

| Purpose | Preferred tool (2026) | One-liner | Fallback |
|---|---|---|---|
| Secrets (full history) | **gitleaks** / trufflehog | `gitleaks detect --source . -v --redact` | grep over `git log -p --all` (§2) |
| Dependency CVEs (multi-ecosystem) | **osv-scanner** (Google/OSV) | `osv-scanner scan source -r .` | per-ecosystem audit (§4) |
| All-in-one (CVE + secrets + misconfig + license) | **Trivy** | `trivy fs --scanners vuln,secret,misconfig,license .` | — |
| SAST / dangerous code patterns | **Semgrep** (or **OpenGrep**, its OSS fork) | `semgrep scan --config auto .` | grep patterns (§3) |
| Malicious-package behavior (not just CVEs) | **Socket** | `socket scan create .` / `sfw npm install` (blocks at install) | typosquat grep (§3) |
| SBOM generate + scan | **Syft + Grype** | `syft . -o cyclonedx-json > sbom.json && grype sbom:sbom.json` | — |

> CVE scanners (Trivy/OSV/Grype) catch *known-vulnerable* deps. They do NOT catch a freshly-published *malicious* package with no CVE yet — that's what behavioral tools (Socket) and the manual pattern checks in §3 are for. Run at least one of each class.

---

## 2. Secrets & Credentials Scan

Secrets persist in history even after being "removed" — scan **full history**, not just the working tree.

```bash
# Preferred
gitleaks detect --source . -v --redact
# or
trufflehog filesystem . --only-verified

# Fallback: pattern grep across ALL history
git log -p --all | grep -EnI \
  'AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]+|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20}'

# Credential files that shouldn't ship (added at any point in history)
git log --all --diff-filter=A --name-only | grep -Ei '\.env($|\.)|\.pem$|id_rsa$|\.p12$|\.pfx$|credentials\.json$|\.npmrc$|\.pypirc$'
```

Flag any hit — even in a deleted/old commit. A leaked key doesn't stop being valid because the file was later removed; treat as **compromised until rotated**.

---

## 3. Malicious / Suspicious Code Patterns

Grep for patterns from real supply-chain attacks. A hit is a *lead to investigate*, not automatic proof of malice — but every hit gets a look, not a dismissal.

### 3.1 Dynamic execution & obfuscation entry points

```bash
grep -rnE '\beval\s*\(|new Function\s*\(|child_process\.(exec|execSync|spawn)\s*\(|require\(\s*["'\'']child_process|subprocess\.(Popen|call|run).*shell\s*=\s*True|os\.system\s*\(|__import__\s*\(' \
  --include='*.js' --include='*.mjs' --include='*.ts' --include='*.py' --include='*.rb' --include='*.php' \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=vendor .

# The signature combo behind most 2025-26 JS payloads: decode-then-execute
grep -rnE "(atob|Buffer\.from\([^,]+,\s*['\"]base64|base64\.b64decode)\s*\([^)]*\).{0,60}(eval|Function|exec|spawn)" \
  --exclude-dir=node_modules --exclude-dir=.git .
```

### 3.2 Exfiltration / C2 channels

```bash
grep -rnE 'https?://([0-9]{1,3}\.){3}[0-9]{1,3}|pastebin\.com|discord(app)?\.com/api/webhooks|hooks\.slack\.com|api\.telegram\.org/bot|ngrok\.io|\.oastify\.com|requestbin|webhook\.site' \
  --exclude-dir=node_modules --exclude-dir=.git .

# Reverse shell / crypto-miner signatures
grep -rnE '/bin/(sh|bash)\s+-i|nc\s+-e\s|bash\s+-i\s+>&|stratum\+tcp://|xmrig|coinhive|minergate' \
  --exclude-dir=node_modules --exclude-dir=.git .

# Credential/env harvesting (Shai-Hulud-style: grab tokens then phone home)
grep -rnE 'process\.env|os\.environ|~/\.aws/credentials|~/\.npmrc|NPM_TOKEN|GITHUB_TOKEN|AWS_SECRET' \
  --include='*.js' --include='*.py' --exclude-dir=node_modules --exclude-dir=.git . | \
  grep -iE 'fetch|axios|https?\.request|requests\.(post|get)|curl|urllib'   # env read AND network in the same area = suspicious
```

### 3.3 Install-time triggers (fire on `npm install` / `pip install` / `make`)

```bash
# npm: pre/post/install hooks in the ROOT and EVERY nested package.json
grep -nE '"(pre|post)?install"\s*:' package.json 2>/dev/null
find . -name package.json -not -path '*/node_modules/*' -exec grep -lE '"(pre|post)?install"\s*:' {} \;

# Python: setup.py overriding the install command class = arbitrary code on `pip install`
grep -nE 'cmdclass|class\s+\w*[Ii]nstall|from setuptools.command' setup.py 2>/dev/null

# Makefile: what does bare `make` actually run?
awk '/^[a-zA-Z0-9_.-]+:/{print} NR<=40' Makefile 2>/dev/null
```

### 3.4 Import-time triggers (fire on `require`/`import`, NOT install — the newer 2026 vector)

A package can be scoped clean at install and still detonate the first time your code `require`s it. Look for **top-level side effects** in entry modules — network calls, `exec`, or decode-execute running at module scope rather than inside an exported function.

```bash
# Identify entry points, then read them by hand for top-level (non-function-wrapped) side effects
jq -r '.main // "index.js", .module // empty, (.bin | if type=="object" then .[] else . end)? // empty' package.json 2>/dev/null
# Python entry points
grep -rnE '^\s*(import os|import subprocess|__import__|exec\(|eval\()' $(find . -name '__init__.py' -not -path '*/venv/*') 2>/dev/null
```

Read each entry file: legitimate libraries define functions/classes and do nothing on load. **Network I/O, process spawning, or filesystem credential reads executing at the top level of an entry module is a strong red flag** regardless of install hooks.

### 3.5 Typosquatting & dependency confusion

Skim manifest dependency names for near-miss spellings of popular packages (`reqeusts`→`requests`, `crossenv`→`cross-env`, `python3-dateutil`→`python-dateutil`, `lodahs`→`lodash`), and for internal-looking scoped names that could be **dependency-confusion** bait. Cross-check anything suspicious against the real registry:

```bash
# Does this npm package exist / who owns it / when published?
npm view <pkg> maintainers time.created time.modified dist.integrity 2>/dev/null
# Registry age — a "popular" util published last week is suspect
pip index versions <pkg> 2>/dev/null
```

---

## 4. Dependency Vulnerability Scan

Prefer the multi-ecosystem tools from §1.1 (`osv-scanner`, `trivy`). Per-ecosystem fallbacks:

| Ecosystem | Command |
|---|---|
| Node | `osv-scanner scan source -r .` · or `npm audit --omit=dev` / `pnpm audit` / `yarn npm audit` |
| Python | `pip-audit -r requirements.txt` · or `osv-scanner scan source -r .` |
| Go | `govulncheck ./...` (also does reachability) · or `osv-scanner scan source -r .` |
| Rust | `cargo audit` |
| PHP | `composer audit` |
| Ruby | `bundle audit check --update` |
| Java | `osv-scanner scan source -r .` (reads `pom.xml`/gradle lock) |
| Any / all at once | `trivy fs --scanners vuln .` or `osv-scanner scan source -r .` |

Also flag (these bypass CVE databases entirely):
- Dependencies pulled from a **git URL or non-standard registry** instead of the official index.
- A dependency pinned to a **git commit SHA on a fork** rather than an upstream release — verify the fork is legit.
- **Lockfile ↔ manifest mismatch** — a lockfile resolving a dependency to an unexpected registry/version is a classic dependency-confusion tell.

---

## 5. License Compliance

```bash
ls LICENSE LICENSE.md LICENSE.txt COPYING 2>/dev/null   # missing = "no license, reuse is legally risky"
trivy fs --scanners license .                            # one tool, all deps
# or per-ecosystem:
npx license-checker --summary        # Node
pip-licenses                          # Python
go-licenses report ./...              # Go
```

Flag: no LICENSE at all; copyleft (GPL/AGPL) when the intended use is inside a proprietary/closed product; any dependency license that conflicts with the consuming project's own license.

---

## 6. Git History & Provenance Signals

```bash
# Commit signing + npm provenance
git log --show-signature -5
npm audit signatures 2>/dev/null              # verifies published provenance/attestations for installed deps

# Burst of commits from a brand-new author right before a release tag = classic takeover pattern
git log --format='%an %ad %s' --date=short | head -30
git for-each-ref --sort=-creatordate --format='%(refname:short) %(creatordate:short)' refs/tags | head

# Social-proof + maintenance signals (if `gh` is authenticated)
gh repo view <owner>/<repo> --json stargazerCount,forkCount,pushedAt,isArchived,licenseInfo
```

Flag: repo archived/unmaintained (unpatched CVEs with no fix coming), a thin history relative to claimed popularity, an unexplained maintainer/ownership handoff right before a version bump, or unsigned releases where the project historically signed.

---

## 7. File-Type & Binary Audit

```bash
# Binaries that don't belong in a source-only repo
find . -type f \( -name '*.exe' -o -name '*.dll' -o -name '*.so' -o -name '*.dylib' -o -name '*.node' -o -name '*.wasm' -o -name '*.bin' \) \
  -not -path '*/node_modules/*' -not -path '*/.git/*'

# Minified/obfuscated code committed as "source" (outside expected build-output dirs)
grep -rlE '.{500,}' --include='*.js' --exclude-dir=node_modules . | grep -vE '(dist|build|vendor|\.min\.)' \
  | xargs -I{} sh -c 'awk "END{if(NR<3)print FILENAME}" "{}"' 2>/dev/null

# Large base64/hex blobs embedded directly in source (payload-hiding)
grep -rlE '[A-Za-z0-9+/]{300,}={0,2}' --include='*.js' --include='*.py' --include='*.json' --exclude-dir=node_modules .
```

---

## 8. If the User Decides to Proceed — Safe-Install Recipe

Only after the report is delivered and the user accepts the residual risk. Never run these silently.

```bash
# 1) Install with ALL lifecycle scripts blocked (defuses install-time payloads), lockfile-exact
npm ci --ignore-scripts            # npm  (npm v12+ blocks scripts by default; --ignore-scripts is still explicit)
pnpm install --ignore-scripts      # pnpm (v11 blocks non-allowlisted builds by default)
yarn install --mode=skip-build     # yarn berry

# 2) Or gate the install behind Socket Firewall — blocks known-malicious/risky packages pre-install, no account needed
sfw npm install                    # works for npm/yarn/pnpm/pip/uv/cargo

# 3) Python: install without building from source arbitrary code
pip install --only-binary=:all: -r requirements.txt   # avoid source setup.py execution where wheels exist

# 4) Prefer a release cooldown — malicious versions are usually pulled within 2-12h, so avoid brand-new releases
#    pnpm: set minimumReleaseAge (e.g. 1440 min) in pnpm-workspace.yaml
#    yarn: npmMinimalAgeGate

# 5) Verify provenance after resolving the tree
npm audit signatures
```

Then, if a legitimate build genuinely needs a specific package's script (e.g. `esbuild`, `sharp`), allowlist **only that package** (pnpm `allowBuilds` / yarn `dependenciesMeta.built`) rather than re-enabling all scripts globally.

---

## 9. Report Format

Always end with one structured report — don't leave findings scattered across the conversation.

```markdown
## Repo Scan Report — <owner>/<repo>

**Overall risk:** 🟢 Low / 🟡 Medium / 🔴 High
**Verdict:** Safe to install / Review flagged items first / Do NOT install without further review

### What runs automatically
**Install-time**
- [ ] npm `pre/postinstall` (root + nested): <command, or "none">
- [ ] `setup.py` custom install class: <yes/no>
- [ ] Default `make` target: <what it does, or "no Makefile">
**Import-time**
- [ ] Top-level side effects in entry module(s): <network/exec/none>

### Findings
| Severity | Category | Finding | Location | Recommendation |
|---|---|---|---|---|
| 🔴 High | Secret / Payload / Malicious dep | ... | `path:line` or `pkg@ver` | ... |
| 🟡 Medium | Dependency CVE | ... | `pkg@ver` | Upgrade to `x.y.z` |
| 🟢 Low | License / Hygiene | ... | `LICENSE` | ... |

### Tools run
gitleaks ✓ · osv-scanner ✓ · semgrep ✓ · trivy ✓ · (manual grep for import-time) ✓  — note any that weren't available.

### Coverage note
Static analysis only. No dynamic/sandbox execution of the repo's own code was performed. Static scanning cannot catch runtime-gated logic bombs or payloads decoded only at execution time — treat "clean" as "no static red flags", not "proven safe".
```

---

## Anti-patterns

- Running `npm install` / `pip install -r` / `make` / `docker build` / `npx <repo>` *before* the scan completes, "just to see" — that is precisely the attack surface this command exists to avoid touching first.
- Only checking `postinstall` and forgetting **import-time** payloads — 2026 campaigns moved to module-load execution specifically to dodge install-script scanners.
- Running only a CVE scanner (Trivy/OSV) and calling it done — those miss brand-new *malicious* packages that have no CVE yet. Pair with a behavioral/pattern pass.
- Auto-running fixes (`npm audit fix`, dependency bumps, `--fix`) without showing the report and getting explicit confirmation.
- Treating GitHub stars/forks as a trust signal — popular repos get taken over via compromised maintainer accounts; the download count is the *reason* they're targeted.
- Scanning only the working tree and skipping git history — a since-removed secret or since-reverted malicious commit is still a real historical exposure.
- Declaring a repo "clean" without stating coverage limits — static analysis is necessary, not sufficient.
- Re-enabling all lifecycle scripts globally to make one build work, instead of allowlisting the single package that needs it.

---

## When to Run /repo-scan

- Immediately after `git clone`-ing any third-party/OSS repo you intend to build, run, or depend on.
- Before merging a vendored copy of an external repo into your own codebase.
- Before running an unfamiliar repo's install script in CI or on any machine with real credentials/secrets present.
- After an upstream dependency update, before bumping the pin — re-scan the new version (and prefer letting it age past a cooldown window first).
