# Fixture Add Failed Fetch Bugfix Design

## Overview

When a user submits the "Add Fixture" form, the app displays a "Failed to fetch" error. Two independent defects combine to produce this failure:

1. **Invalid Foreign Key**: `FixtureForm.tsx` hardcodes `seasonId: 'season_01'`, but no season with that ID exists in the `seasons` table. The SQLite `FOREIGN KEY` constraint (enabled via `foreign_keys = ON` pragma) rejects the insert.
2. **Missing Error Handling**: Express route handlers delegate to async controller methods (`fixtureController.create(req, res)`) without wrapping them in try/catch or using global error middleware. When the repository throws, the exception is unhandled—no HTTP response is ever sent, and the client's `fetch()` call times out with "Failed to fetch".

The fix adds async error-handling middleware to Express and ensures the fixture form uses a valid season ID by fetching seasons from the API and seeding a default season during database setup.

## Glossary

- **Bug_Condition (C)**: A fixture creation request where the `seasonId` does not exist in the `seasons` table AND the async controller has no error boundary to catch the resulting exception
- **Property (P)**: A fixture creation request with valid data returns HTTP 201 with the new fixture; invalid requests return structured error responses (4xx/5xx)
- **Preservation**: Existing validation logic (Zod schema checks, business rules like "opponent required for matches"), fixture listing/update/cancel endpoints, and client-side form validation must remain unchanged
- **FixtureForm**: React component in `client/src/components/fixtures/FixtureForm.tsx` that collects fixture data and POSTs to `/api/fixtures`
- **fixtureController.create**: Async method in `server/src/controllers/fixture.controller.ts` that validates and creates a fixture
- **asyncHandler**: A wrapper utility (to be created) that catches rejected promises from async route handlers and forwards them to Express error middleware
- **Season**: A record in the `seasons` table linked to a club, representing a playing period with format/duration settings

## Bug Details

### Bug Condition

The bug manifests when a user submits the Add Fixture form. The form sends `seasonId: 'season_01'` to `POST /api/fixtures`, but no row with `id = 'season_01'` exists in the `seasons` table. SQLite's foreign key constraint enforcement (enabled in `db/index.ts` via `sqlite.pragma('foreign_keys = ON')`) causes the `INSERT INTO fixtures` statement to throw. Because the route handler `(req, res) => fixtureController.create(req, res)` does not catch the resulting promise rejection, Express never sends a response—the client sees a network-level "Failed to fetch" TypeError.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { seasonId: string, type: string, date: string, ... }
  OUTPUT: boolean
  
  RETURN input.seasonId NOT IN (SELECT id FROM seasons)
         AND routeHandler lacks try/catch or asyncHandler wrapper
         AND the rejected promise is never forwarded to Express error middleware
END FUNCTION
```

### Examples

- **Example 1**: User opens Add Fixture form, selects type "match", enters date "2026-08-01", opponent "Valley United". Form submits `{ seasonId: 'season_01', type: 'match', date: '2026-08-01', opponent: 'Valley United' }`. Server throws `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`. No HTTP response sent. Client shows "Failed to fetch".
- **Example 2**: User creates a "training" type fixture with date "2026-08-05". Same `seasonId: 'season_01'` is sent. Same FK violation. Same hung connection.
- **Example 3**: Even if the seasonId were valid, any other unhandled exception in any async controller (e.g., disk full, corrupted DB) would also hang the connection due to missing error middleware.
- **Edge case**: If a season with `id = 'season_01'` happened to exist (e.g., manually inserted), the fixture would be created successfully—proving the error handling gap is only exposed by the FK violation in normal usage.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Zod schema validation on `POST /api/fixtures` continues to return 400 with field-level errors for invalid payloads (missing date, invalid type, etc.)
- Business rule enforcement: matches/friendlies without an opponent return `{ error: 'OPPONENT_REQUIRED' }` with HTTP 400
- `GET /api/fixtures`, `GET /api/fixtures/:id`, `GET /api/fixtures/next` continue to return fixture data with filtering support
- `PUT /api/fixtures/:id` and `POST /api/fixtures/:id/cancel` continue to work for valid requests
- `DELETE /api/fixtures/:id` continues to reject deletion of completed fixtures
- Client-side form validation (required date, required opponent for match types) remains unchanged
- All other API endpoints (players, availability, team-selection, etc.) continue to function normally

**Scope:**
All inputs that do NOT involve an invalid `seasonId` on fixture creation—and all non-fixture endpoints—should be completely unaffected by this fix. This includes:
- Fixture form submissions where a valid season is selected
- All fixture read/update/cancel/delete operations
- All other API resource endpoints
- Mouse interactions, form field changes, and client-side validation

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Hardcoded Non-Existent Season ID**: `FixtureForm.tsx` line 30 sets `seasonId: fixture?.seasonId ?? 'season_01'` as a fallback. The `seasons` table is never seeded with data—no club or season exists after running migrations. The `seed-all.ts` script only seeds policies and development goals, not clubs/seasons.

2. **No Async Error Boundary in Routes**: In `fixture.routes.ts`, handlers are defined as `(req, res) => fixtureController.create(req, res)`. The controller methods are `async` but the route callback doesn't `await` or `.catch()` the returned promise. Express 4.x does not natively handle rejected promises from route handlers—unhandled rejections simply disappear, leaving the response stream open.

3. **No Global Express Error Middleware**: `app.ts` has no `app.use((err, req, res, next) => {...})` error handler registered after routes. Even if errors were forwarded via `next(err)`, there's nothing to format and send an error response.

4. **No Season API Endpoint**: There is no `/api/seasons` endpoint for the client to fetch available seasons. The form has no way to dynamically select a valid season—hence the hardcoded placeholder.

## Correctness Properties

Property 1: Bug Condition - Fixture Creation Succeeds With Valid Season

_For any_ fixture creation request where all validation passes (valid type, date present, opponent present for match types) AND a valid seasonId referencing an existing season is provided, the fixed system SHALL successfully insert the fixture and return HTTP 201 with the new fixture data.

**Validates: Requirements 2.1, 2.3**

Property 2: Bug Condition - Unhandled Errors Return HTTP 500

_For any_ async controller method that throws an unhandled exception (including but not limited to foreign key violations, database errors, unexpected runtime errors), the fixed system SHALL catch the error and return an HTTP 500 response with a JSON body containing `{ error: 'INTERNAL_SERVER_ERROR', message: <string> }` rather than leaving the connection hanging.

**Validates: Requirements 2.2**

Property 3: Preservation - Validation Errors Unchanged

_For any_ fixture creation request where Zod schema validation fails OR business rules reject the input (e.g., missing opponent for match type), the fixed system SHALL produce the same HTTP 400 response with the same error structure as the original code.

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation - Read/Update/Delete Operations Unchanged

_For any_ fixture read, update, cancel, or delete operation, the fixed system SHALL produce the same results as the original code, preserving all existing query filtering, status transitions, and error responses.

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/src/app.ts`

**Change 1: Add Global Async Error Middleware**
- Register an Express error-handling middleware (`(err, req, res, next)`) AFTER all routes are set up but BEFORE the static file serving and SPA fallback
- The middleware should log the error and respond with HTTP 500 and a JSON error body
- This ensures any unhandled exception from any route handler results in a proper error response

**File**: `server/src/routes/fixture.routes.ts` (and all other route files)

**Change 2: Wrap Async Handlers**
- Create a utility function `asyncHandler` that wraps async route handlers: `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`
- Apply `asyncHandler` to all route definitions so rejected promises are forwarded to the error middleware
- This is a systematic fix that protects ALL routes, not just fixture creation

**File**: `server/src/db/seed-all.ts` (or new seed script)

**Change 3: Seed a Default Club and Season**
- Add a default club record (e.g., `id: 'club_default'`) and a default season record (e.g., `id: 'season_default'`) to the seed script
- The season should have realistic defaults (current year dates, 7v7 format, etc.)
- This ensures at least one valid season exists for the fixture form to reference

**File**: `server/src/routes/index.ts` and new files

**Change 4: Add Seasons API Endpoint**
- Create a minimal `GET /api/seasons` endpoint that returns all seasons (or at minimum the active season)
- This allows the client to fetch available seasons dynamically

**File**: `client/src/components/fixtures/FixtureForm.tsx`

**Change 5: Fetch and Use Valid Season ID**
- Replace the hardcoded `'season_01'` with a dynamically fetched season ID
- On form mount, fetch seasons from the API and default to the active season
- If no seasons exist, show an appropriate message or disable the form

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write integration tests that POST to `/api/fixtures` with `seasonId: 'season_01'` and observe the response behavior. Run these tests on the UNFIXED code to confirm the connection hangs (request timeout rather than error response).

**Test Cases**:
1. **FK Violation Test**: POST `{ seasonId: 'season_01', type: 'match', date: '2026-08-01', opponent: 'Test FC' }` to `/api/fixtures` — expect timeout/no response on unfixed code
2. **Controller Exception Test**: Simulate a throw inside an async controller method — expect no error response on unfixed code
3. **Valid Season Test**: Manually insert a season with `id = 'season_01'` then POST — expect success (proving FK is the root cause)
4. **Other Route Exception Test**: Force an error in another async route (e.g., players) — expect same hanging behavior on unfixed code

**Expected Counterexamples**:
- POST to `/api/fixtures` with non-existent seasonId never returns a response (confirmed by request timeout)
- Server process logs `UnhandledPromiseRejection` or `SQLITE_CONSTRAINT` to stderr
- Possible causes confirmed: FK constraint + no async error boundary

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := POST /api/fixtures with input using fixed server
  ASSERT result.status IN [201, 400, 500]
  ASSERT result.body contains valid JSON with either { data } or { error, message }
  ASSERT response received within reasonable timeout (no hanging)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fixedServer.handleRequest(input) = originalServer.handleRequest(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various fixture types, valid/invalid fields, edge cases)
- It catches edge cases that manual unit tests might miss (e.g., boundary string lengths, unusual characters in opponent names)
- It provides strong guarantees that validation behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for valid operations (with a manually seeded season), then write property-based tests capturing that behavior to ensure the fix doesn't alter it.

**Test Cases**:
1. **Validation Preservation**: Verify that submitting fixtures with missing date still returns 400 with `VALIDATION_ERROR`
2. **Business Rule Preservation**: Verify that match-type fixtures without opponent still return 400 with `OPPONENT_REQUIRED`
3. **Read Endpoint Preservation**: Verify that GET /api/fixtures returns the same data shape and filtering
4. **Update/Cancel Preservation**: Verify that PUT and POST cancel endpoints behave identically for valid and invalid IDs

### Unit Tests

- Test `asyncHandler` utility correctly forwards errors to `next()`
- Test `asyncHandler` utility does not interfere with successful responses
- Test global error middleware returns proper JSON error format
- Test FixtureForm uses fetched season ID instead of hardcoded value
- Test seed script creates valid club and season records

### Property-Based Tests

- Generate random fixture creation payloads with valid season IDs and verify the response is always well-formed JSON (never a timeout)
- Generate random invalid payloads (missing fields, wrong types) and verify the same 400 validation errors are returned as before the fix
- Generate random sequences of create/read/update/cancel operations and verify fixture state transitions are consistent

### Integration Tests

- Test full flow: seed database → open fixture form → verify season dropdown populated → submit form → verify 201 response
- Test error resilience: trigger various server errors and verify all return proper HTTP error responses within timeout
- Test that existing fixture list page continues to load and filter correctly after the fix
