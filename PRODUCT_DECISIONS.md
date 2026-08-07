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
