# Code Review Checklist

## Review Output Format

```markdown
# Review: {TICKET-ID} - {Title}

**Reviewer**: Codex (o3)
**Date**: {timestamp}
**Branch**: {branch-name}
**Status**: PASS | PASS_WITH_NOTES | FAIL

## Summary
{1-2 sentence overview of changes and quality assessment}

## Checklist Results
| Category | Status | Notes |
|----------|--------|-------|
| Type Safety | PASS/FAIL | ... |
| Architecture | PASS/FAIL | ... |
| Error Handling | PASS/FAIL | ... |
| Performance | PASS/FAIL | ... |
| Testing | PASS/FAIL | ... |
| Security | PASS/FAIL | ... |
| Code Style | PASS/FAIL | ... |
| Ticket Compliance | PASS/FAIL | ... |

## Issues Found
### Critical (must fix)
- {description} at {file}:{line}

### Suggestions (recommended)
- {description}

## Acceptance Criteria Verification
- [ ] {criterion 1}: PASS/FAIL
- [ ] {criterion 2}: PASS/FAIL
```

## Checklist Items

### Type Safety
- [ ] No `any` types used
- [ ] Public APIs have explicit return types
- [ ] Uses `@photoshop-app/types` for shared types
- [ ] No local type duplication of shared types

### Architecture
- [ ] Respects package boundaries — no cross-package implementation imports
- [ ] No circular imports
- [ ] Implements interfaces from `@photoshop-app/types`
- [ ] Uses EventBus for cross-module communication

### Error Handling
- [ ] Async operations have try/catch
- [ ] User-facing error messages are clear
- [ ] File I/O handles corruption gracefully

### Performance
- [ ] No unnecessary object creation in render loops
- [ ] Uses typed arrays where appropriate
- [ ] Canvas operations are batched

### Testing
- [ ] All public functions have unit tests
- [ ] Edge cases are tested
- [ ] No test state pollution between cases

### Security
- [ ] No `eval()` or `new Function()`
- [ ] IPC messages are validated
- [ ] File paths are sanitized
- [ ] Renderer has no `nodeIntegration`

### Code Style
- [ ] ESLint passes with 0 warnings
- [ ] Prettier formatted
- [ ] Public APIs have JSDoc
- [ ] Variable names are meaningful

### Ticket Compliance
- [ ] All acceptance criteria met
- [ ] No scope creep
- [ ] Follows AGENTS.md rules
