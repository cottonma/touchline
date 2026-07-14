import { api } from '@/lib/api';

export interface DashboardData {
  nextFixture: {
    id: string;
    type: string;
    opponent: string | null;
    date: string;
    kickOffTime: string | null;
    location: string | null;
    homeAway: string | null;
    daysUntil: number;
  } | null;
  availability: {
    fixtureId: string | null;
    available: number;
    unavailable: number;
    unknown: number;
    total: number;
  };
  squad: {
    activeCount: number;
    gkVolunteers: number;
  };
  recentResults: {
    fixtureId: string;
    date: string;
    opponent: string | null;
    goalsFor: number;
    goalsAgainst: number;
    result: string | null;
  }[];
  seasonStats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  playingTimeBalance: {
    playerName: string;
    totalMinutes: number;
    outfieldMinutes: number;
  }[];
  outstandingActions: string[];
}

export const dashboardApi = {
  get: () => api.get<{ data: DashboardData }>('/dashboard'),
};
