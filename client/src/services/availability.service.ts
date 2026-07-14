import { api } from '@/lib/api';

/**
 * Availability API service.
 */

export interface AvailabilityRecord {
  id: string;
  fixtureId: string;
  playerId: string;
  status: 'available' | 'unavailable' | 'unknown';
  reason: string | null;
  updatedAt: string;
  playerFirstName?: string;
  playerLastName?: string;
}

export interface AvailabilitySummary {
  available: number;
  unavailable: number;
  unknown: number;
}

interface AvailabilityResponse {
  data: AvailabilityRecord[];
  summary: AvailabilitySummary;
}

interface SingleAvailabilityResponse {
  data: AvailabilityRecord;
}

export const availabilityApi = {
  getByFixture: (fixtureId: string) =>
    api.get<AvailabilityResponse>(`/fixtures/${fixtureId}/availability`),

  update: (fixtureId: string, playerId: string, status: string, reason?: string) =>
    api.put<SingleAvailabilityResponse>(`/fixtures/${fixtureId}/availability`, {
      playerId,
      status,
      reason,
    }),

  batchUpdate: (fixtureId: string, items: { playerId: string; status: string; reason?: string }[]) =>
    api.post<{ data: AvailabilityRecord[]; count: number }>(`/fixtures/${fixtureId}/availability/batch`, {
      items,
    }),
};
