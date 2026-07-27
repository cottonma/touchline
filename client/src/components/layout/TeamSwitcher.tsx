import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Club {
  id: string;
  name: string;
  teamName: string | null;
}

/**
 * Team switcher dropdown for admin users.
 * Fetches all clubs and allows switching the active team context.
 * Invalidates all cached data when team changes.
 */
export function TeamSwitcher() {
  const { activeClubId, setActiveClubId } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    api.get<Club[]>('/auth/clubs')
      .then(setClubs)
      .catch(() => {});
  }, []);

  if (clubs.length === 0) {
    return null;
  }

  const handleChange = (newClubId: string) => {
    setActiveClubId(newClubId);
    // Remove all cached data and refetch with new club context
    // Small delay ensures localStorage is updated before refetch
    setTimeout(() => {
      queryClient.removeQueries();
      queryClient.invalidateQueries();
    }, 100);
  };

  return (
    <div className="px-3">
      <select
        id="team-switcher"
        value={activeClubId || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
    </div>
  );
}
