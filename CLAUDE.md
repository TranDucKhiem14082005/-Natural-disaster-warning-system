# CLAUDE.md

He thong canh bao thien tai - hoc phan Phat trien ma nguon mo (PTMNM). Stack: PHP Laravel.
Dac ta chuc nang: @He_thong_canh_bao_thien_tai_PHP_Laravel.md

## Rules (luon ap dung)

@.claude/rules/agent/token.md
@.claude/rules/agent/multi-agent.md
@.claude/rules/code/folder-structure.md
@.claude/rules/code/naming-conventions.md
@.claude/rules/docs/docs-placement.md
@.claude/rules/docs/asset-placement.md
@.claude/rules/docs/roadmap-sync.md

Laravel chua co trong bang folder-structure -> theo layout chuan Laravel (`app/Http/Controllers`, `app/Models`, `app/Services`, `routes/`, `database/migrations`, `resources/views`).

## Commands / Skills (nap khi can, khong import san)

- Slash commands: `.claude/commands/` (vd `/build`, `/cicd`, `/frontend`, `/unit-tests`, `/repo-scan`, `/harden`, `/monitoring`).
- Skills: `.claude/skills/` (`qa-testing`, `diagram-design`, `ha`, `jenkins`, `payment`, `prod-incident`, `rabbitmq`).

## References (doc khi task lien quan)

- Phan quyen theo vai tro: `.claude/references/RBAC.md`
- Luong dang nhap / OAuth / OTP: `.claude/references/auth-flow.md`
- Domain + SSL: `.claude/references/domain-ssl-checklist.md`
- Code quality: `.claude/references/sonarqube.md`
- K8s dashboard: `.claude/references/k8s-dashboard-domain-setup.md`
