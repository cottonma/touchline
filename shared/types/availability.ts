/**
 * Availability types - tracks player availability per fixture.
 */

import type { AvailabilityStatus } from './enums.js';

export interface Availability {
  id: string;
  fixtureId: string;
  playerId: string;
  status: AvailabilityStatus;
  reason: string | null;
  updatedAt: string;
}

export interface UpdateAvailabilityInput {
  fixtureId: string;
  playerId: string;
  status: AvailabilityStatus;
  reason?: string;
}
