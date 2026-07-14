# Known Issues

Running list of bugs, technical debt, future improvements, and deferred functionality.

---

## Technical Debt

| # | Issue | Priority | Notes |
|---|-------|----------|-------|
| 1 | ESLint not configured with custom rules | Low | Using TypeScript strict mode as primary guard |
| 2 | No Prettier configuration | Low | Add before team collaboration |
| 3 | No automated tests | Medium | Add Vitest when first complex logic is built |

---

## Deferred Functionality (Intentional)

| # | Feature | Reason | Target Release |
|---|---------|--------|---------------|
| 1 | Communications module | Not needed for MVP per coach feedback | Post-MVP |
| 2 | Live match timer | Requires phone/mobile access | When app is multi-device |
| 3 | Authentication | Single user, local machine | When multi-user introduced |
| 4 | Parent portal | Out of MVP scope | Future release |
| 5 | Assistant coach access | Out of MVP scope | Future release |
| 6 | Club administration | Out of MVP scope | Future release |
| 7 | Multi-team support | Out of MVP scope | Future release |
| 8 | Push notifications | Requires cloud hosting | Future release |
| 9 | Opposition scouting (AI) | Unlikely grassroots use case | Evaluate post-MVP |

---

## Future Improvements (Nice to Have)

| # | Idea | Notes |
|---|------|-------|
| 1 | Data export to JSON/CSV | Safety net for local database |
| 2 | Auto-backup to file | Scheduled backup of SQLite file |
| 3 | Print substitution plan as card | Low-tech pitchside aid before mobile app |
| 4 | Dark mode | Common user preference |
| 5 | Keyboard shortcuts | Power user productivity |
| 6 | Undo/redo for data changes | Safety net for mistakes |

---

## Bugs

None reported yet.
