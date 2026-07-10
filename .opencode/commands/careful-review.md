---description: Careful code review with checklist---
Do a thorough review of $ARGUMENTS (files, changes, or the whole project).

Checklist:
1. Correctness — does the logic handle edge cases?
2. Security — any injection, exposure, or auth issues?
3. Performance — unnecessary work, large payloads, N+1 queries?
4. Error handling — graceful failures, proper messages?
5. Types — TypeScript types correct, no `any` abuse?
6. Style — follows project conventions?
7. Testing — adequate coverage, meaningful tests?

For each issue, specify: file, line, what's wrong, and how to fix.
