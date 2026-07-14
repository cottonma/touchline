import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/services/reports.service';

const REPORTS_KEY = ['reports'] as const;

export function usePlayingTimeReport() {
  return useQuery({ queryKey: [...REPORTS_KEY, 'playing-time'], queryFn: () => reportsApi.getPlayingTime(), select: (r) => r.data });
}

export function useAttendanceReport() {
  return useQuery({ queryKey: [...REPORTS_KEY, 'attendance'], queryFn: () => reportsApi.getAttendance(), select: (r) => r.data });
}

export function usePlayerReport(playerId: string | undefined) {
  return useQuery({ queryKey: [...REPORTS_KEY, 'player', playerId], queryFn: () => reportsApi.getPlayerReport(playerId!), select: (r) => r.data, enabled: !!playerId });
}

export function useSeasonResultsReport() {
  return useQuery({ queryKey: [...REPORTS_KEY, 'season-results'], queryFn: () => reportsApi.getSeasonResults(), select: (r) => r.data });
}

export function useGkRotationReport() {
  return useQuery({ queryKey: [...REPORTS_KEY, 'gk-rotation'], queryFn: () => reportsApi.getGkRotation(), select: (r) => r.data });
}

export function useDevelopmentReport() {
  return useQuery({ queryKey: [...REPORTS_KEY, 'development'], queryFn: () => reportsApi.getDevelopmentProgress(), select: (r) => r.data });
}
