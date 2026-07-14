# Bugfix Requirements Document

## Introduction

When a user fills out the "Add Fixture" form and clicks submit, the app displays a "failed to fetch" error. The root cause is twofold: (1) the fixture form hardcodes `seasonId: 'season_01'` which does not exist in the `seasons` table, causing a SQLite foreign key constraint violation on insert, and (2) the Express route handlers use async controller methods without try/catch or global error middleware, so unhandled exceptions cause the server to never send a response — resulting in a network-level "Failed to fetch" on the client.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits the Add Fixture form THEN the system throws an unhandled SQLite foreign key constraint error because `seasonId: 'season_01'` does not exist in the `seasons` table, and the server never sends an HTTP response

1.2 WHEN any async controller method throws an unhandled exception THEN the system leaves the HTTP connection hanging without sending an error response, causing the client to receive a "Failed to fetch" TypeError

1.3 WHEN the fixture form is rendered THEN the system hardcodes `seasonId: 'season_01'` regardless of whether that season exists in the database

### Expected Behavior (Correct)

2.1 WHEN a user submits the Add Fixture form with valid data THEN the system SHALL successfully create the fixture in the database and return an HTTP 201 response with the new fixture data

2.2 WHEN any async controller method throws an unhandled exception THEN the system SHALL catch the error and return an HTTP 500 response with an appropriate error message rather than leaving the connection hanging

2.3 WHEN the fixture form is rendered THEN the system SHALL use a valid season ID that exists in the database (either from an active season context or by ensuring the referenced season is created during setup)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits the Add Fixture form with invalid data (e.g., missing required date) THEN the system SHALL CONTINUE TO return a 400 validation error with field-level details

3.2 WHEN a user submits a match-type fixture without an opponent THEN the system SHALL CONTINUE TO return a 400 business rule error indicating opponent is required

3.3 WHEN a user fetches the list of fixtures THEN the system SHALL CONTINUE TO return fixture data correctly with filtering by status, type, and season

3.4 WHEN a user updates or cancels an existing fixture THEN the system SHALL CONTINUE TO process the request and return the updated fixture data
