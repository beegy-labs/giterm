# Commit Fix

> ADD Execution | **Last Updated**: 2026-03-24

## Trigger

CI "Validate commit messages" fails, or user requests commit message cleanup.

## Read Before Execution

- `.ai/git-flow.md` — commit format rules

## CI Regex

```
^(feat|fix|chore|docs|refactor|test|perf|ci|build|revert|style)\([a-z0-9-]+\): .+
```

Fails when:
- Scope missing: `docs: ...` instead of `docs(scope): ...`
- Scope has invalid chars: `+`, `_`, uppercase
- Unknown type: `update(api): ...`

## Execution

| Step | Action |
| ---- | ------ |
| 1 | Find failing: `git log --format="%H %s" origin/develop..HEAD` |
| 2 | Test each against CI regex |
| 3 | Create todo.sh (mark `reword`) + msg.sh (replace message by content match) |
| 4 | Run: `GIT_SEQUENCE_EDITOR=todo.sh GIT_EDITOR=msg.sh git rebase -i origin/develop` |
| 5 | Validate: `git log --format="%s" origin/develop..HEAD | grep -vE "<regex>"` |
| 6 | Force push: `git push --force-with-lease origin <branch>` |

## Rules

| Rule | Detail |
| ---- | ------ |
| Use `--force-with-lease` | Never bare `--force` |
| Rebase from `origin/develop` | Not from local develop |
| Validate after rebase | Zero output = all pass |
| Todo uses 7-char hash | Git rebase todo truncates to 7 chars |
