---description: Finish development work, verify and commit---

1. Run the verification command: !`npm test 2>&1`
2. Run linting/typecheck: !`npm run lint 2>&1; npm run typecheck 2>&1`
3. Review git status and diff
4. If everything passes, stage changes and commit with a descriptive message
5. Report what was done, what passed, and any issues found

If tests fail, DO NOT commit — report the failures.
