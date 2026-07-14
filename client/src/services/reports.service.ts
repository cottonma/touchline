import { api } from '@/lib/api';

export interface PlayingTimeSummaryReport {
  title: string;
  generatedAt: string;
  players: { name: string; outfieldMinutes: number; gkMinutes: number; totalMinutes: number; appearances: number; percentageOfAvailableTime: number }[];
  totals: { totalMatchMinutes: number; averagePerPlayer: number };
}

export interface AttendanceReport {
  title: string;
  generatedAt: string;
  players: { name: string; matchesAvailable: number; matchesPlayed: number; trainingSessions: number; trainingAttended: number; matchAttendanceRate: number; trainingAttendanceRate: number }[];
}

export interface PlayerReportCard {
  title: string;
  generatedAt: string;
  player: { name: string; shirtNumber: number | null; position: string; preferredFoot: string | null };
  stats: { appearances: number; goals: number; assists: number; cleanSheets: number; motmAwards: number; outfieldMinutes: number; gkMinutes: number };
  development: { totalGoals: number; achieved: number; improving: number; workingOnIt: number };
}

export interface SeasonResultsReport {
  title: string;
  generatedAt: string;
  summary: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; cleanSheets: number; winPercentage: number };
  results: { date: string; opponent: string | null; goalsFor: number; goalsAgainst: number; result: string | null }[];
}

export interface GkRotationReport {
  title: string;
  generatedAt: string;
  volunteers: { name: string; totalGkMinutes: number; matchesInGoal: number; periodsInGoal: number }[];
}

export interface DevelopmentProgressReport {
  title: string;
  generatedAt: string;
  players: { name: string; totalGoals: number; achieved: number; improving: number; workingOnIt: number; goals: { title: string; category: string; status: string }[] }[];
}

export const reportsApi = {
  getPlayingTime: () => api.get<{ data: PlayingTimeSummaryReport }>('/reports/playing-time'),
  getAttendance: () => api.get<{ data: AttendanceReport }>('/reports/attendance'),
  getPlayerReport: (playerId: string) => api.get<{ data: PlayerReportCard }>(`/reports/player/${playerId}`),
  getSeasonResults: () => api.get<{ data: SeasonResultsReport }>('/reports/season-results'),
  getGkRotation: () => api.get<{ data: GkRotationReport }>('/reports/gk-rotation'),
  getDevelopmentProgress: () => api.get<{ data: DevelopmentProgressReport }>('/reports/development'),
};
