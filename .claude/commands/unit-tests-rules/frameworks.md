# unit-tests · Framework Map & Naming

> Load this only when you need the cross-language reference (unfamiliar stack, or naming idiom for a language you're not sure about). If the repo clearly uses one stack, you already know it from Step 1 — skip this.

## Framework Map (detect from the repo, don't assume)

| Language | Test runner | Assertions | Mocking / doubles |
|---|---|---|---|
| Java | JUnit 5 | AssertJ | Mockito (`@ExtendWith(MockitoExtension.class)`) |
| JS / TS | Jest or Vitest | built-in `expect` | `jest.mock` / `vi.mock`, `vi.fn()` |
| Python | pytest | plain `assert` | `unittest.mock` / `pytest-mock` (`mocker`) |
| Go | `testing` (+ testify optional) | testify `assert`/`require` or stdlib | interfaces + hand/`gomock` fakes; table-driven tests |
| C# / .NET | xUnit (or NUnit) | FluentAssertions | Moq / NSubstitute |
| Ruby | RSpec | `expect().to` | `double` / `instance_double`, `allow`/`receive` |
| PHP | PHPUnit | `assert*` | `createMock()` |
| Rust | built-in `#[test]` | `assert!`/`assert_eq!` | trait objects / `mockall` |
| Kotlin | JUnit 5 / Kotest | Kotest matchers | MockK |
| Swift | XCTest / Swift Testing | `#expect` / `XCTAssert` | protocol-based fakes |

Pick what the repo already uses. If nothing is set up, propose the ecosystem default and confirm before adding a dependency.

## Naming Convention

Format: `{unitUnderTest}_{givenState}_{expectedOutcome}` (adapt separators to the language's idiom).

| Language | Idiomatic form |
|---|---|
| Java / C# / JS-method | `calculateTotal_validProducts_returnsSum` |
| Python | `test_calculate_total_valid_products_returns_sum` |
| Go | `TestCalculateTotal_ValidProducts_ReturnsSum` (or table-driven case name `"valid products returns sum"`) |
| JS/TS (BDD) | `describe("calculateTotal")` → `it("returns the sum for valid products")` |

Examples: `getUser_unauthorized_returns401`, `createOrder_nullProductId_throwsValidationError`, `withdraw_insufficientFunds_returnsError`.

## Parameterized / table-driven (one behavior × many inputs)

Same logic, many input→output pairs → one parameterized test with **named cases** so a failing row names the input. Different *behaviors* still get separate tests.

| Language | Idiom |
|---|---|
| Java (JUnit 5) | `@ParameterizedTest` + `@CsvSource` / `@MethodSource` |
| Go | table-driven: `for _, tc := range cases { t.Run(tc.name, func(t *testing.T){…}) }` |
| Python (pytest) | `@pytest.mark.parametrize("in,out", [...], ids=[...])` |
| C# (xUnit) | `[Theory]` + `[InlineData(...)]` / `[MemberData]` |
| JS/TS (Jest/Vitest) | `it.each([...])("case %s", (in, out) => {…})` |
| Ruby (RSpec) | shared examples / a `[[in,out]].each` loop around `it` |
| Kotlin | JUnit `@ParameterizedTest` or Kotest `withData` |
