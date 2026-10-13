# Lint fixtures

A miniature repository tree for `tests/unit/tools/lint.test.ts`. Each file named after a rule holds deliberate
violations of exactly that rule; every `clean*` file must produce no finding. `tools/lint.ts` skips this folder when it
lints the real repository, and `tsconfig.json` excludes it.
