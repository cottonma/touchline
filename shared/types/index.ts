/**
 * Shared types used by both client and server.
 * These define the API contract between frontend and backend.
 */

export type { Club, CreateClubInput, UpdateClubInput } from './club.js';
export type { Season, CreateSeasonInput, UpdateSeasonInput } from './season.js';
export type { Player, CreatePlayerInput, UpdatePlayerInput } from './player.js';
export type { Fixture, CreateFixtureInput, UpdateFixtureInput } from './fixture.js';
export type { Availability, UpdateAvailabilityInput } from './availability.js';
export type { Policy, UpdatePolicyInput } from './policy.js';
export type {
  MatchFormat,
  MatchStructure,
  Position,
  PreferredFoot,
  AvailabilityStatus,
  FixtureType,
  FixtureStatus,
  MatchObjective,
  HomeAway,
  DevelopmentCategory,
  DevelopmentStatus,
  PositionGroup,
  CoachingPhilosophy,
  PolicyCategory,
} from './enums.js';
