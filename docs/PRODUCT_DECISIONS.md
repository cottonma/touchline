# Product Decisions

The definitive record of every significant product decision made during Touchline development.

---

## PD-001: Skip Authentication for MVP 0.1

**Date:** 2026-07-04

**Background:** The specification mentions "simple and local" authentication. However, MVP 0.1 supports a single coach on a single local machine.

**Decision:** No authentication in MVP 0.1. The app opens directly to the dashboard.

**Reasoning:** Authentication adds friction without value for a single-user local application. Every second spent logging in is a second not coaching.

**Alternatives Considered:**
- Simple PIN/passcode (adds friction, no real security benefit locally)
- Full auth with sessions (over-engineered for local use)

**Impact:** Faster onboarding, simpler architecture. Auth middleware layer designed for easy addition later.

**Future Considerations:** Add auth when multi-user support is introduced (parent portal, assistant coach).

---

## PD-002: Equal Playing Time Per Match (Not Season)

**Date:** 2026-07-04

**Background:** The spec requires "equal playing time" but doesn't define the scope.

**Decision:** Equal outfield minutes within each individual match. No cross-match compensation. If a player misses a match, they don't get extra time next week.

**Reasoning:** Each match is a fresh opportunity. Compensating for missed matches would create unfair imbalances where some children sit out longer in individual games. Every child present deserves equal time that day.

**Alternatives Considered:**
- Season-level balancing (creates per-match inequality)
- Rolling average compensation (complex, hard to explain to parents)

**Impact:** Simpler engine logic. Season stats tracked for reporting but don't drive allocation.

**Future Considerations:** Season stats visible in reports so coach can see overall trends.

---

## PD-003: Goalkeeper Time Excluded from Outfield Minutes (Option A)

**Date:** 2026-07-04

**Background:** GK volunteers sacrifice outfield time. Two options: (A) GK gets full outfield time only in non-GK periods, (B) GK must match everyone's outfield minutes exactly.

**Decision:** Option A – GK plays full outfield time in periods they're not in goal. They may get slightly fewer outfield minutes than pure outfield players.

**Reasoning:** Simpler engine. GKs accept a slight outfield trade-off as part of volunteering. The system tracks GK minutes separately as a valued contribution.

**Alternatives Considered:**
- Option B: Equal outfield for everyone (requires GK to play some outfield in their GK periods – complex, impractical)

**Impact:** Cleaner substitution plans. GK is effectively removed from the outfield rotation for their GK periods.

**Future Considerations:** None needed – this is a natural grassroots coaching pattern.

---

## PD-004: Minimum Play Rule – Every Other Quarter

**Date:** 2026-07-04

**Background:** Need to ensure no child sits on the bench too long (cold, disengaged, parents unhappy).

**Decision:** Every player must play at least every other quarter. No child sits out two consecutive quarters.

**Reasoning:** Keeps children warm, engaged, and gives parents something to watch every 12 minutes.

**Alternatives Considered:**
- No minimum rule (risk of child sitting out for a full half)
- Every quarter guaranteed (mathematically impossible with 13 players and 7 spots)

**Impact:** Engine constraint. When generating sub plans, no player can be benched for periods N and N+1.

**Future Considerations:** Configurable via policy engine for different coaching styles.

---

## PD-005: Clean Sheet Attribution Per Quarter

**Date:** 2026-07-04

**Background:** How to award clean sheets to defenders – whole match result or only periods on pitch?

**Decision:** A defender/GK earns a clean sheet if no goals were conceded during the specific quarters they were on the pitch, AND they played at least 2 quarters.

**Reasoning:** Fairer attribution. A defender who played well in Q1-Q2 shouldn't lose their clean sheet because a goal was conceded in Q4 when they were on the bench.

**Alternatives Considered:**
- Whole-match clean sheet (simpler but unfair to benched players)
- No clean sheet stat (loses valuable coaching data)

**Impact:** Requires tracking goals conceded per quarter and cross-referencing with playing time records.

**Future Considerations:** May need UI explanation for parents in future ("clean sheet means no goals conceded while on pitch").

---

## PD-006: Communications Deferred from MVP 0.1

**Date:** 2026-07-04

**Background:** Original spec includes communications (match reminders, training reminders generated for WhatsApp).

**Decision:** Remove communications module entirely from MVP 0.1.

**Reasoning:** Coach already uses WhatsApp directly and is comfortable with that workflow. Adding message generation doesn't save enough time to justify the effort in MVP. Better to focus on core coaching features.

**Alternatives Considered:**
- Simple template messages (minimal value-add over typing directly)
- AI-generated messages (dependency on AI for basic feature)

**Impact:** Reduces MVP scope. One fewer module to build and maintain.

**Future Considerations:** Reintroduce when app is accessible to parents or when AI Coach is mature enough to generate contextual messages.

---

## PD-007: No Live Match Timer in MVP 0.1

**Date:** 2026-07-04

**Background:** A live timer on the phone telling the coach when to substitute would be valuable but requires phone access.

**Decision:** Defer live match timer. MVP uses post-match recording on laptop with pre-filled substitution plan.

**Reasoning:** MVP runs on laptop only. Coach can't use laptop pitchside. Live timer needs the mobile app (future release). Post-match recording with pre-filled plan is the practical compromise.

**Alternatives Considered:**
- Build timer anyway for laptop (impractical at pitchside)
- Print sub plan as a card (low-tech, could work as interim)

**Impact:** Match Day module is simpler – pre-match planning + post-match recording only.

**Future Considerations:** High-priority feature when app is accessible on phone. Sub plan could be exported/printed as interim solution.

---

## PD-008: SQLite for Local-First MVP

**Date:** 2026-07-04

**Background:** Need a database for a local-first application that can later migrate to cloud.

**Decision:** SQLite via better-sqlite3 with Drizzle ORM. Repository pattern for future PostgreSQL migration.

**Reasoning:** Zero configuration, file-based, excellent performance for single-user. Drizzle ORM supports both SQLite and PostgreSQL, making future migration straightforward.

**Alternatives Considered:**
- PostgreSQL locally (overkill, requires installation)
- JSON files (no query capability, no relational integrity)
- IndexedDB (browser-only, no server-side access)

**Impact:** Simple setup, single file database. Coach can back up by copying one file.

**Future Considerations:** Migrate to PostgreSQL when moving to cloud. Drizzle schema maps directly.

---

## PD-009: Match Structure – 4 Quarters of 12 Minutes (Configurable)

**Date:** 2026-07-04

**Background:** Need to define match structure for the playing time engine.

**Decision:** Default 48-minute match with 4 x 12-minute quarters. Also supports 2 x 24-minute halves. Configurable per season.

**Reasoning:** Quarters are the most common grassroots format and give more natural substitution break points. Supporting halves ensures flexibility for different leagues.

**Alternatives Considered:**
- Fixed quarters only (less flexible)
- Thirds (non-standard, not used in grassroots)

**Impact:** Period duration = match_duration / periods. Engine uses this for time calculations.

**Future Considerations:** Tournament matches may have different durations – per-fixture override possible in future.

---

## PD-010: Playing Time Tolerance of ±2 Minutes

**Date:** 2026-07-04

**Background:** Perfect equality is impossible with rolling subs and quarter-based rotation.

**Decision:** Maximum ±2 minutes difference between any two outfield players' time in a single match.

**Reasoning:** Reflects practical coaching reality. Sub changes take time, exact minute splits are impossible. ±2 minutes is tight enough to be fair but achievable.

**Alternatives Considered:**
- ±1 minute (too tight, would require very frequent subs)
- ±5 minutes (too loose, some players get significantly more time)

**Impact:** Engine validation constraint. Flags plans that exceed tolerance.

**Future Considerations:** Configurable via policy engine for different coaching styles.

---

## PD-011: Development Goals Assigned to Player, Not Position

**Date:** 2026-07-04

**Background:** Goal library is organised by position. How are goals assigned?

**Decision:** Goals are assigned to the player regardless of what position they play in a given match. Position categories are for organising the library only.

**Reasoning:** A development goal like "scan before receiving" applies whenever the player is on the pitch, not only when playing a specific position.

**Alternatives Considered:**
- Position-linked goals (too restrictive, players move between positions)

**Impact:** Simple assignment model. Library browsing is position-filtered but assignment is player-level.

**Future Considerations:** None – this is the natural coaching approach.

---

## PD-012: AI Provider – OpenAI GPT-4o-mini

**Date:** 2026-07-04

**Background:** AI features need an LLM provider.

**Decision:** OpenAI API with GPT-4o-mini model. Abstracted behind a provider interface for future swap.

**Reasoning:** Best balance of quality, cost (~£0.01-0.05 per request), and ease of integration. Interface abstraction allows swapping to Bedrock, local LLM, or other providers without code changes.

**Alternatives Considered:**
- Amazon Bedrock (more setup, AWS account required)
- Local LLM via Ollama (free but lower quality, needs good hardware)
- No AI in MVP (loses key differentiator)

**Impact:** Requires internet for AI features. Core features work offline. Coach needs OpenAI API key.

**Future Considerations:** Monitor costs. Consider caching common responses. Evaluate local models as they improve.
