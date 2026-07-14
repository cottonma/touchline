# Implementation Plan

## Overview

This plan follows the exploratory bugfix workflow to fix the "Failed to fetch" error when adding a fixture. The bug is caused by a hardcoded non-existent `seasonId` combined with missing async error handling in Express routes. The fix adds async error middleware, seeds a valid season, exposes a seasons API, and updates the form to use a dynamic season ID.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Fixture Creation Fails With Invalid Season ID
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to fixture creation requests where `seasonId` does not exist in the `seasons` table. For deterministic reproduction, use `seasonId: 'season_01'` with any valid fixture payload (type, date, opponent)
  - Write a property-based test that POSTs to `/api/fixtures` with `{ seasonId: 'season_01', type: 'match', date: '2026-08-01', opponent: 'Test FC' }` and asserts that the server responds with a well-formed HTTP response (status 201 or a structured error 4xx/5xx) within a reasonable timeout
  - The test assertions should match the Expected Behavior: for valid payloads with a valid season, expect HTTP 201; for invalid seasons or server errors, expect a structured JSON error response (not a timeout/hang)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (request times out or no response is received, confirming the bug — unhandled FK constraint violation leaves the connection hanging)
  - Document counterexamples found: POST with `seasonId: 'season_01'` never returns a response; server logs `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` or `UnhandledPromiseRejection`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Validation and Business Rule Errors Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Step 1 - Observe on UNFIXED code**: Manually seed a valid season in the test database, then:
    - Observe: POST `/api/fixtures` with missing `date` field returns 400 with `VALIDATION_ERROR` and field-level details
    - Observe: POST `/api/fixtures` with `type: 'match'` and no `opponent` returns 400 with `OPPONENT_REQUIRED` error
    - Observe: GET `/api/fixtures` returns fixture list with correct data shape and filtering support
    - Observe: PUT `/api/fixtures/:id` with valid data returns updated fixture; with invalid ID returns appropriate error
  - **Step 2 - Write property-based tests**: For all fixture creation requests where `seasonId` IS valid but other fields are invalid (missing date, wrong type, missing opponent for match types), assert the response is HTTP 400 with the same validation/business-rule error structure as observed on unfixed code
  - Property: For all payloads where the bug condition does NOT hold (valid seasonId exists) AND validation fails, the server returns HTTP 400 with structured JSON error — same as original behavior
  - Property: For all GET/PUT/DELETE fixture operations, the response shape, status codes, and business logic remain unchanged
  - Verify tests pass on UNFIXED code (with a seeded valid season)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for fixture creation "Failed to fetch" error

  - [ ] 3.1 Create `asyncHandler` utility wrapper
    - Create `server/src/middleware/async-handler.ts` with a utility function that wraps async route handlers: `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`
    - This ensures any rejected promise from an async controller is forwarded to Express error middleware
    - _Bug_Condition: isBugCondition(input) where routeHandler lacks try/catch or asyncHandler wrapper AND rejected promise is never forwarded to Express error middleware_
    - _Expected_Behavior: All async route handlers forward exceptions to error middleware_
    - _Preservation: Successful responses must pass through unchanged_
    - _Requirements: 2.2_

  - [ ] 3.2 Add global Express error-handling middleware
    - Create `server/src/middleware/error-handler.ts` with an Express error middleware `(err, req, res, next) => {...}`
    - The middleware should log the error and respond with HTTP 500 and JSON body `{ error: 'INTERNAL_SERVER_ERROR', message: <string> }`
    - Register this middleware in `server/src/app.ts` AFTER all routes but BEFORE static file serving and SPA fallback
    - _Bug_Condition: isBugCondition(input) where unhandled exceptions cause no HTTP response_
    - _Expected_Behavior: expectedBehavior(result) — all unhandled exceptions produce HTTP 500 with structured JSON error_
    - _Preservation: Must not interfere with normal successful responses or existing 4xx error responses from controllers_
    - _Requirements: 2.2_

  - [ ] 3.3 Apply `asyncHandler` to all route files
    - Wrap all async route handlers in `server/src/routes/fixture.routes.ts` with `asyncHandler`
    - Apply the same pattern to all other route files (player, availability, team-selection, etc.) for comprehensive coverage
    - _Bug_Condition: isBugCondition(input) where route handlers do not catch rejected promises_
    - _Expected_Behavior: All route handlers forward errors to Express error middleware_
    - _Preservation: All existing route functionality must remain unchanged for successful requests_
    - _Requirements: 2.2_

  - [ ] 3.4 Seed default club and season in database setup
    - Update `server/src/db/seed-all.ts` (or create a new seed script) to insert a default club record and a default season record with realistic values (e.g., `id: 'season_default'`, current year dates, 7v7 format)
    - Ensure the seed runs as part of the standard database setup so at least one valid season always exists
    - _Bug_Condition: isBugCondition(input) where input.seasonId NOT IN (SELECT id FROM seasons)_
    - _Expected_Behavior: A valid season always exists in the database after setup_
    - _Preservation: Existing seed data (policies, development goals) must not be affected_
    - _Requirements: 2.1, 2.3_

  - [ ] 3.5 Add seasons API endpoint
    - Create `GET /api/seasons` endpoint that returns all seasons (or at minimum the active season for the current club)
    - Add route file `server/src/routes/season.routes.ts` and register in the main router
    - _Expected_Behavior: Client can fetch available seasons dynamically_
    - _Preservation: No existing API endpoints should be affected_
    - _Requirements: 2.3_

  - [ ] 3.6 Update FixtureForm to use dynamic season ID
    - Replace the hardcoded `'season_01'` in `client/src/components/fixtures/FixtureForm.tsx` with a dynamically fetched season ID
    - On form mount, fetch seasons from `/api/seasons` and default to the active/first available season
    - If no seasons exist, show an appropriate message or disable form submission
    - _Bug_Condition: isBugCondition(input) where form sends seasonId that does not exist in seasons table_
    - _Expected_Behavior: Form always sends a valid seasonId that exists in the database_
    - _Preservation: All other form fields, client-side validation, and form behavior must remain unchanged_
    - _Requirements: 1.3, 2.1, 2.3_

  - [ ] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Fixture Creation Succeeds With Valid Season ID
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: fixture creation with valid data returns HTTP 201 or structured error responses (never a timeout/hang)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — server always responds with structured HTTP response)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Validation and Business Rule Errors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — validation errors, business rules, read/update/delete operations all behave identically)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite to confirm all exploration, preservation, and unit tests pass
  - Verify no regressions in existing functionality
  - Ensure all tests pass, ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    ["1"],
    ["2"],
    ["3.1", "3.2"],
    ["3.3", "3.4", "3.5"],
    ["3.6"],
    ["3.7", "3.8"],
    ["4"]
  ]
}
```

- Wave 1: Bug Condition Exploration Test must be written and run first to confirm the bug
- Wave 2: Preservation Tests must pass on unfixed code before any implementation
- Wave 3: asyncHandler utility and error middleware can be created in parallel
- Wave 4: Route wrapping (depends on 3.1), seed data, and seasons API can proceed in parallel
- Wave 5: Form update depends on seasons API (3.5) and seed data (3.4)
- Wave 6: Verify exploration and preservation tests pass after fix
- Wave 7: Final checkpoint ensures all tests pass

## Notes

- The exploration test (task 1) is expected to FAIL on unfixed code — this is correct behavior that confirms the bug exists
- The preservation tests (task 2) are expected to PASS on unfixed code — they capture baseline behavior that must not change
- After the fix, both exploration and preservation tests should PASS
- The `asyncHandler` pattern protects ALL routes, not just fixture creation, providing defense-in-depth against future unhandled async errors
- A valid season must be seeded before the form fix can work correctly
