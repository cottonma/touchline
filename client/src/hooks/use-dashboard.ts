import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/dashboard.service';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(),
    select: (r) => r.data,
    refetchInterval: 60000, // Refresh every minute
  });
}
