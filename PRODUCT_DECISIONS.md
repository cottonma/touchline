# Product Decisions

## Fundamental Redesign: Team Selection → Visual Match Planning

**Date:** August 2026  
**Status:** Proposed — awaiting approval before implementation

---

## 1. Assessment of Current Implementation

### What Exists Today

The current Team Selection is an **algorithm-first** system:
1. Coach clicks "Generate Team Selection"
2. Engine produces a complete plan (positions, subs, minutes)
3. Coach makes edits via tap-to-swap UI
4. Coach approves → saved as JSON blob

### What's Wrong

| Problem | Impact |
|---------|--------|
| Coach has no control from the start — must accept generated output then hack it | Frustrating UX |
| No visual pitch representation | Hard to understand at a glance |
| Can't start from blank | Forces reliance on algorithm |
| Entire plan stored as single JSON blob | Can't query, version, or partially update |
| `team_selections` table exists but is unused — orphaned schema | Confusing architecture |
| GK rotation history never actually reads past data | Rotation doesn't work |
| No concept of "draft" — only "approved" | Can't save partial work |
| Match Day has no structured link to planned vs actual | Can't track deviations |
| Match objective doesn't influence plan generation | Policy is decorative |
| Position rotation policy exists but isn't consumed | Dead configuration |

### What Can Be Retained

| Component | Verdict |
|-----------|---------|
| `playing-time.engine.ts` algorithm | **Keep** — solid minute-balancing logic, use as "Generate" suggestion |
| `getFormationPositionSlots()` | **Keep** — formation → position slot mapping works |
| `assignFormationPositions()` | **Keep** — player-to-slot fit scoring |
| `suggestGkAssignments()` | **Keep** — but wire up actual history |
| Policy service & storage | **Keep** — extend with new policies |
| `playing_time` table (actuals) | **Keep** — remains the source of truth for what happened |
| `match_results`, `goals` tables | **Keep** — unchanged |
| Availability system | **Keep** — feeds the player pool |
| Client position fit colouring | **Keep** — moves into the new pitch component |

---

## 2. Proposed Data Model: `match_plans`

Replace `substitution_plans` (JSON blob) with a normalised, queryable model.

### New Tables

```sql
-- The top-level match plan for a fixture
CREATE TABLE match_plans (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) UNIQUE,
  club_id TEXT REFERENCES clubs(id),
  status TEXT NOT NULL DEFAULT 'draft',
    -- 'not_started' | 'draft' | 'ready' | 'match_started' | 'completed'
  formation TEXT,            -- e.g. '2-3-1'
  periods INTEGER NOT NULL,  -- e.g. 4
  period_duration_minutes NUMERIC NOT NULL, -- e.g. 12
  match_duration_minutes INTEGER NOT NULL,
  outfield_slots INTEGER NOT NULL,
  generated_by TEXT,         -- 'engine' | 'coach' | null
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One row per player per period (who plays where and when)
CREATE TABLE match_plan_slots (
  id TEXT PRIMARY KEY,
  match_plan_id TEXT NOT NULL REFERENCES match_plans(id) ON DELETE CASCADE,
  period INTEGER NOT NULL,        -- 1, 2, 3, 4...
  player_id TEXT NOT NULL REFERENCES players(id),
  position TEXT NOT NULL,         -- 'GK', 'LB', 'RB', 'CM', etc.
  is_gk BOOLEAN NOT NULL DEFAULT false,
  start_minute INTEGER NOT NULL DEFAULT 0,  -- minute within period (0 = from start)
  end_minute INTEGER NOT NULL,              -- minute within period (period_duration = full)
  created_at TEXT NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_plan_slots_plan_period ON match_plan_slots(match_plan_id, period);
CREATE INDEX idx_plan_slots_player ON match_plan_slots(player_id);
```

### Why This Model

- **Normalised** — can query "what periods does player X play?" without parsing JSON
- **Period-independent** — works for 2 halves, 4 quarters, 6 periods, anything
- **Sub-friendly** — a within-period sub = two rows for the same position (one with end_minute < period_duration, another with start_minute > 0)
- **Draft-safe** — incomplete plans are valid (some periods may have empty slots)
- **Versioning-ready** — could add a `version` column later for undo
- **Match Day bridge** — `match_plan_slots` = planned, `playing_time` = actual

### Migration from Current

- Drop reliance on `substitution_plans` table (keep it for historical data but stop writing to it)
- Drop the unused `team_selections` table
- New code writes to `match_plans` + `match_plan_slots`

---

## 3. Proposed UX: Visual Match Planning Workspace

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│  Fixture Header: vs Methley | Sat 9 Aug | Home          │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│     FOOTBALL PITCH       │     PLAYER POOL              │
│                          │                              │
│     [GK]                 │  Available (10):             │
│   [LB]  [RB]            │  ┌───────────────────┐       │
│  [LM] [CM] [RM]         │  │ Leo  CM  45m ✓    │       │
│     [CF]                 │  │ Max  CF  30m ⚠   │       │
│                          │  │ Henry CB  45m ✓   │       │
│  ── Bench ──             │  │ ...               │       │
│  [Kaeden] [Freddie]     │  └───────────────────┘       │
│                          │                              │
├──────────────────────────┼──────────────────────────────┤
│ Q1 │ Q2 │ Q3 │ Q4       │   INTELLIGENCE PANEL         │
│ ▬▬▬                      │   Available: 10              │
│ Period tabs              │   Selected: 9                │
│                          │   Highest: 48m               │
│                          │   Lowest: 36m                │
│                          │   ⚠ 1 player under target   │
│                          │   ⚠ 1 out-of-position       │
└──────────────────────────┴──────────────────────────────┘
```

### Layout (Mobile)

```
┌────────────────────────────┐
│ vs Methley | Sat 9 Aug     │
├────────────────────────────┤
│ [Q1] [Q2] [Q3] [Q4]       │ ← period tabs
├────────────────────────────┤
│        PITCH               │
│       [GK]                 │
│     [LB] [RB]             │
│   [LM] [CM] [RM]          │
│       [CF]                 │
│                            │
│   Bench: Kaeden, Freddie   │
├────────────────────────────┤
│ Available Players          │ ← scrollable pool
│ ┌────┐ ┌────┐ ┌────┐      │
│ │Leo │ │Max │ │Noah│      │
│ │CM  │ │CF  │ │CB  │      │
│ │45m │ │30m │ │45m │      │
│ └────┘ └────┘ └────┘      │
├────────────────────────────┤
│ ⚠ 1 under target │ ✓ Valid │ ← intelligence bar
├────────────────────────────┤
│ [Generate] [Save Draft]    │ ← bottom actions
└────────────────────────────┘
```

### Interactions

**Drag & Drop (desktop):** Drag player from pool → drop onto position slot on pitch. Slot highlights when valid drop target.

**Tap-to-Place (mobile):** Tap player in pool (highlights), tap position on pitch (places them). Or tap occupied position → shows action sheet (swap, remove, set sub time).

**Period Navigation:** Tabs across the top. Each period is independently editable. "Copy from Q1" button when starting Q2.

**Within-Period Substitutions:**
- Long-press/tap a player on pitch → "Add sub timing" option
- Shows a slider: "Leaves at minute X"
- Then prompts: "Who comes on?" → tap from bench/pool
- Both entries appear in the period: one with endMinute=X, one with startMinute=X

**Position Swaps:** Tap player A on pitch, tap player B on pitch → they swap positions. Or drag one onto the other.

---

## 4. Playing-Time Calculations

Calculated live on the client as the coach edits:

```typescript
interface PlayerPlanSummary {
  playerId: string;
  totalMinutes: number;      // sum of all slot durations
  outfieldMinutes: number;   // slots where isGk=false
  gkMinutes: number;         // slots where isGk=true
  periodsPlayed: number;     // count of periods with any slot
  periodsStarting: number;   // count of periods where startMinute=0
  periodsOnBench: number;    // periods with no slot at all
  differenceFromAverage: number; // positive = over, negative = under
}
```

Recalculates after every edit. Displayed in the Intelligence Panel and on each player card in the pool.

**Warning thresholds** (from policies):
- Playing time difference > `tolerance_minutes` → amber warning
- Player not allocated any minutes → red warning  
- Player in non-preferred position → info note (per existing colour system)
- Consecutive bench periods > `max_consecutive_bench_periods` → amber warning

---

## 5. Generate Team (Engine Integration)

The existing `generateSubstitutionPlan()` engine remains. But instead of its output being the UI, its output gets **converted into `match_plan_slots` rows** and loaded into the workspace.

Flow:
1. Coach clicks "Generate Team"
2. Server runs engine → produces `SubstitutionPlan`
3. Server converts `PeriodPlan[]` into `match_plan_slots` rows → saves with `generated_by: 'engine'`
4. Client loads the workspace with slots populated
5. Coach edits freely — every edit is a client-side mutation of the slots array
6. Coach saves (draft or ready)

From the coach's perspective, there's no difference between a generated plan and a manually built one.

---

## 6. Match Day Integration

**Plan → Match Day handoff:**
- When match starts, Match Day page reads `match_plan_slots` for period 1
- Shows the lineup, planned subs, upcoming periods
- Coach records deviations (real subs, injuries, position changes)

**Planned vs Actual:**
- `match_plan_slots` = what was planned
- `playing_time` table = what actually happened (recorded post-match)
- Future: dashboard shows "Plan adherence: 85%" type metrics

**Match Day remains separate** — it records what happened. Team Selection plans what should happen. They share the same player/position vocabulary but are intentionally decoupled.

---

## 7. Edge Cases & Technical Risks

| Risk | Mitigation |
|------|-----------|
| Drag-and-drop on mobile is hard | Primary interaction = tap-to-place. Drag is desktop enhancement only |
| Large squads (14+ players) | Scrollable pool, search/filter by position |
| Coach saves draft, then squad changes (player becomes unavailable) | Show warning on load: "Player X is no longer available" — let coach fix |
| Two devices editing same plan | Last-write-wins (match plans aren't collaborative). Could add optimistic locking later |
| Offline at the pitch | Service worker caching for the workspace page. Queue saves, sync when online |
| Formation changes between sessions | If season formation changes, existing draft plans keep their original formation. Coach can regenerate |
| Very short periods (5 min) where subs don't make sense | Engine already handles `minSubMinutes`. UI skips sub timing if period < 2x minSubMinutes |

---

## 8. Implementation Plan

### Phase 1: Data Model (server)
- Create `match_plans` + `match_plan_slots` tables + migration
- Create `matchPlanService` with CRUD: create, get, update slots, delete slot, save status
- Create conversion utility: `SubstitutionPlan → match_plan_slots[]`
- API routes: GET/POST/PUT/DELETE
- Keep existing `substitution_plans` for backward compat (read-only)

### Phase 2: Pitch Component (client)
- Build `<PitchView formation="2-3-1">` component
- Renders formation positions as droppable slots
- Shows player names, position badges, fit colours
- Handles tap-to-place and slot swapping
- Responsive: full pitch on desktop, compact on mobile

### Phase 3: Planning Workspace (client)
- New `MatchPlanningPage` component (replaces `TeamSelectionPage`)
- Period tabs with independent pitch views
- Player pool sidebar with live minute calculations
- Intelligence panel with warnings
- "Copy period" functionality
- Within-period sub timing UI (slider)
- Save Draft / Mark Ready actions

### Phase 4: Generate Integration
- Wire "Generate Team" button to existing engine
- Convert engine output to slots format
- Load into workspace
- Coach edits freely from there

### Phase 5: Match Day Bridge
- Update Match Day page to read from `match_plan_slots`
- Pre-populate lineups per period
- Record deviations as actual events
- Post-match: write to `playing_time` table (actuals)

### Phase 6: Polish
- Undo (stack-based, last 10 actions)
- Animations for player movement
- Keyboard shortcuts (desktop)
- Empty state guidance for new coaches
- Performance optimisation for large squads

---

## 9. What Gets Deleted

- `TeamSelectionPage.tsx` (current) — replaced entirely
- Client-side `recalculateSummary()` — server handles this
- `handleSwapPlayers`, `handleSwapStarterWithSub` etc — replaced by generic slot manipulation
- The `team_selections` table (orphaned, never used)
- Writing to `substitution_plans` table (keep for reading old plans)

## 10. What Gets Kept

- `playing-time.engine.ts` — the generation algorithm
- `getFormationPositionSlots()`, `assignFormationPositions()` — position logic
- `suggestGkAssignments()` — GK rotation
- Position fit colour system (`getPositionFit`, `FIT_BADGE_CLASSES`)
- All policy infrastructure
- Availability system (feeds player pool)
- Match Day recording (actuals)
- Client UI components: `Badge`, `Card`, `Button`, bottom sheets, overlays


---

## Addendum: Substitutions & Playing-Time View (August 2026)

### Decision: Within-Quarter Substitutions

**Data model support:** Already exists. `match_plan_slots` rows use `startMinute` and `endMinute` to represent partial periods. A substitution = two rows for the same position in the same period (one ending early, one starting late).

**UX:** SubstitutionPanel component below the pitch in each period:
- Shows existing planned subs as "8' James → Freddie" with inline slider to adjust minute
- "Add Sub" button opens a form: select player off, player on, set minute via slider
- Delete button removes the sub and restores the original player to full period
- All changes immediately recalculate playing time

### Decision: Playing-Time Table

**Implementation:** Separate view tab ("Pitch | Playing Time") operating on the same `allSlots` data.

**Table format:**
| Player | Q1 | Q2 | Q3 | Q4 | Outfield | GK | Total | +/- |

- Figures derived from slot `startMinute`/`endMinute` and `isGk` flag
- GK minutes shown in amber, mixed periods get an asterisk
- Target minutes calculated from `matchDuration × outfieldSlots / totalPlayers`
- Difference column colour-coded: green (within 5), amber (over), red (under)

### Decision: Single Source of Truth

Both views (Pitch + Playing Time table) read from the same `allSlots` state array. No duplication. Changes on the pitch immediately reflect in the table, and vice versa.

### Decision: Goalkeeper Minutes

Distinguished at every level:
- Each slot has `isGk: boolean`
- `playerMinutes` calculation separates `.outfield` and `.gk`
- Playing Time table shows separate OF and GK columns
- Intelligence Panel includes GK time in totals

### Decision: View Switching

Simple toggle: `Pitch | Playing Time` at the top of the workspace area. Both views keep the same period tabs, action buttons, and fixture context. No navigation change, no data reload.


---

## Addendum: Playing-Time Fairness & Saved Plan Versions (August 2026)

### Decision: GK Minutes Excluded from Fairness Calculations

All fairness/balance calculations now use **outfield minutes only**:
- Intelligence Panel: highest/lowest/average = outfield minutes
- Player Pool: +/- difference = outfield vs target
- Playing Time Table: +/- column = outfield vs target
- Warnings: "X min difference" = outfield only

GK minutes continue to be tracked and displayed (GK column, total column) but do not contribute to balance assessment. A player who plays 45 min outfield + 15 min GK is compared equally to a player who plays 45 min outfield + 0 GK.

### Decision: Saved Plan Versions

**Model:** `match_plan_versions` table stores immutable snapshots.
- Each version: `id`, `name`, `slots_snapshot` (full JSON), `formation`, `is_final`, `generated_by`, `created_at`
- Linked to the parent `match_plan` via `match_plan_id`
- A fixture can have one working plan + many saved versions

**Current Save Draft behaviour (BEFORE this change):** Save Draft called `PUT /slots` which overwrites the working plan in-place. No snapshot preserved.

**New behaviour:**
- "Save Draft" now also creates a version snapshot (immutable copy)
- "Generate Team" replaces the working plan but previous saved versions remain intact
- Coach can list/restore/delete versions
- One version can be marked "Final" for Match Day

**API:**
- `GET /match-plans/:fixtureId/versions` — list saved versions
- `POST /match-plans/:fixtureId/versions` — save current as named version
- `POST /match-plans/:fixtureId/versions/:id/restore` — restore version to working plan
- `PUT /match-plans/:fixtureId/versions/:id/final` — mark as final
- `DELETE /match-plans/:fixtureId/versions/:id` — delete version

**Mental model:**
```
Working Plan (live, editable)
    ↓ Save Version
Saved Plans (immutable snapshots)
    ↓ Restore
Working Plan (restored from snapshot)
```

Generate never destroys saved versions. Manual edits never alter saved versions.


---

## Addendum: Match Day — Fixture Identity, Scores & Player Minutes (August 2026)

### Decision: Team Names from Fixture Data

Match Day must never hard-code or invent team names. It uses:
- Club name from `clubs.name` (fetched via active club context)
- Opponent from `fixtures.opponent`
- Home/Away from `fixtures.homeAway`

Display format: Home team `[score] – [score]` Away team. Coach's team position determined by `homeAway` field.

### Decision: Period-by-Period Scores

Add `period_scores` column (JSON) to `match_results` table. Format:
```json
[{"period": 1, "goalsFor": 1, "goalsAgainst": 0}, {"period": 2, "goalsFor": 2, "goalsAgainst": 1}, ...]
```
Final score = sum of period scores (auto-calculated).

### Decision: Actual Minutes from Match Structure

**Current model problem:** `playing_time` stores manually-entered totals. No link to the actual match structure.

**New model:** Match Day saves an "actual match plan" — the same `match_plan_slots` format used by Team Selection but representing what actually happened (after deviations). Actual minutes are then *derived* from these slots, not entered manually.

Flow:
1. Match Day loads the "Ready" team selection plan as the starting point
2. Coach makes live adjustments (sub timing changes, position swaps, injuries)
3. On "Complete Match", the actual slot state is saved
4. `playing_time` records are recalculated from the actual slots (idempotent — editing recalculates)

### Decision: Player Match Participation

Enhance `playing_time` table to include:
- `positions_played` (TEXT, JSON array) — e.g. `["LM", "CM"]`
- `periods_played_detail` (TEXT, JSON) — e.g. `[{"period": 1, "minutes": 15, "position": "LM", "isGk": false}]`

This provides the per-period breakdown needed for detailed stats without a new table.

### Decision: Statistics Derivation

Player season statistics MUST be derived/aggregated from `playing_time` records:
- Appearances = count of `playing_time` rows where totalMinutes > 0
- Total minutes = sum of totalMinutes
- Outfield/GK = sum of respective columns
- Goals/Assists = count from `goals` table
- MOTM = count from `match_results` where motmPlayerId matches

Editing a completed match recalculates that fixture's `playing_time` record (upsert, not append).

### Decision: Planned vs Actual

- `match_plan_slots` (from Team Selection) = **planned**
- `playing_time` records (from Match Day) = **actual**
- Both coexist. Planned is never overwritten by actual.
- Statistics always use actual.


---

## Addendum: Quarter-by-Quarter Formation Changes (August 2026)

### Decision: Formation is per-period, not per-match

**Data model:** `match_plans.period_formations` — JSON field storing `{"1":"2-3-1","2":"1-4-1","3":"1-3-2","4":"2-3-1"}`. The existing `formation` field remains as the default (initial value for all periods).

**Behaviour:**
- New plan: all periods inherit the default formation from Settings
- Coach can change any individual period's formation via a dropdown
- Changing Q2 does NOT affect Q1, Q3, Q4
- Existing player assignments are preserved when formation changes (players remain, positions may need manual adjustment)
- Position warnings continue to apply

**API:** `PUT /match-plans/:fixtureId/formation/:period` — updates one period's formation

**Full Match View:** Shows the formation label on each period (e.g. "Q1 2-3-1", "Q2 1-4-1")

**Saved Plans:** `period_formations` is part of the plan and saved/restored with versions

**Generated Team:** Uses the default formation unless the coach has already set period-specific overrides


---

## Addendum: Scout — Our Team Observations (August 2026)

### Decision: Separate observations table from opposition scouting

`scout_observations` is a new first-class table for per-player and team-level match observations. Separate from:
- `scout_reports` (opposition scouting — formation, key players, threats)
- `development_observations` (linked to development goals)

### Data Model

```
scout_observations
  id, fixture_id, player_id (nullable), scout_id, period, match_minute,
  development_area (physical|technical|mental|teamwork),
  observation_type (strength|development|general),
  observation (text), follow_up (text), timestamps
```

- `player_id = null` → team-level observation
- `player_id = X` → individual player observation
- Linked to fixture permanently — completing/editing a match never deletes observations

### API

- `GET /api/scout-observations?fixtureId=&playerId=` — list with filters
- `POST /api/scout-observations` — quick add (designed for live match use)
- `PUT /api/scout-observations/:id` — edit observation or add follow-up
- `DELETE /api/scout-observations/:id` — remove

### Integration Points

- **Scout page:** New "Our Team" tab for recording observations during matches
- **Match Day:** "Scout Observations" section showing all observations for the fixture
- **Player Detail:** Historical observations timeline
- **Development:** Observations as evidence for goal decisions

### Principles

- No scores, ratings, rankings, or leaderboards
- Descriptive, evidence-based language
- Four development areas: Physical, Technical, Mental, Teamwork
- Three observation types: Strength, Development Opportunity, General
- Fast entry — optimised for sideline use during matches
- Historical integrity — observations persist permanently

---

## Reports Reflect Deleted Fixtures

When a fixture is deleted, its related records (playing time, goals, results, MOTM votes, etc.) are cascade-deleted from the database. Reports must never count data from fixtures that no longer exist.

### Decision

All report calculations filter by the set of fixtures that currently exist and are marked completed (`completedFixtureIds`). This applies to:

- **Playing Time Summary** — minutes and appearances
- **Attendance Report** — matches played / matches available
- **Player Report Card** — appearances, goals, assists, MOTM, clean sheets, minutes
- **GK Rotation Report** — GK minutes, matches/periods in goal

### Rationale

Previously reports counted `playing_time` rows regardless of whether the parent fixture still existed. Deleting a fixture (e.g. a gala) left a player showing "2/3 matches" when it should read "2/2". Filtering by existing completed fixtures keeps all counts consistent with what actually happened.

Historical cleanup: a one-off script removed orphaned records left by fixtures deleted before cascade-delete was implemented. Cascade-delete on the fixture repository now prevents new orphans.

---

## Match Scores Entered as Home – Away

Coaches enter match scores in natural football order: **home team score – away team score**. The app derives which score is ours from the fixture's `homeAway` setting.

### Decision

- Internally, `match_results.goalsFor` = our team's goals and `goalsAgainst` = the opponent's goals. All reports and stats rely on this.
- At the input layer (Match Day), the two score boxes are labelled Home / Away using the real team names. On save, the app maps them:
  - Home fixture: home box → `goalsFor`, away box → `goalsAgainst`
  - Away fixture: home box → `goalsAgainst`, away box → `goalsFor`
- The coach's own team is highlighted (green) on whichever side matches the fixture, so it's always clear.

### Rationale

Previously the score inputs were fixed as "us – them", which was confusing for away games where scores are conventionally read home-first. Entering in home–away order matches how scores are reported elsewhere and removes the risk of recording an away win as a loss.

---

## Team Selection: Position Swap & Fair-Play Guidance

Two enhancements to the Match Planning (Team Selection) page.

### Position swap

A coach can switch two selected players' positions within a quarter by tapping one player on the pitch, then tapping another. Both players exchange positions (including any within-period sub segments). The selection hint now names the selected player and explains the switch.

### Fair-play guidance

When building a plan, the Plan Summary panel shows a fair-play target derived from the coach's own settings (no hardcoded assumptions):

- Available players and outfield spots (from the plan formation)
- Match duration and period structure (quarters/halves, from the season/plan)

It calculates an even share: `targetMinutes = matchDuration × outfieldSlots ÷ availablePlayers`, then expresses it as minutes, as a share of the match (%), and as periods (e.g. "~24 min each (~2 quarters) — 50% of the match"). The period label adapts to the format (half / quarter / period). This gives a coach starting from a blank sheet a concrete playing-time goal per player.
