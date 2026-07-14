import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlayers } from '@/hooks/use-players';
import { PlayerForm } from '@/components/players/PlayerForm';

const POSITION_LABELS: Record<string, string> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'LB',
  RB: 'RB',
  CM: 'CM',
  LM: 'LM',
  RM: 'RM',
  CF: 'CF',
};

const POSITION_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info'> = {
  GK: 'warning',
  CB: 'info',
  LB: 'info',
  RB: 'info',
  CM: 'success',
  LM: 'success',
  RM: 'success',
  CF: 'default',
};

/**
 * Squad page - displays all players with ability to add/edit.
 */
export function PlayersPage() {
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { data: players, isLoading, error } = usePlayers(showInactive);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading squad...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">Error loading players: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Squad</h2>
          <p className="text-muted-foreground">
            {players?.length ?? 0} player{players?.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className={showInactive ? 'border-primary text-primary' : ''}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{showInactive ? 'All' : 'Active'}</span>
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Player</span>
          </Button>
        </div>
      </div>

      {/* Add Player Form (modal-like) */}
      {showForm && (
        <PlayerForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {/* Player List */}
      {!players || players.length === 0 ? (
        <EmptyState onAddPlayer={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-3">
          {players.map((player) => (
            <div
              key={player.id}
              onClick={() => navigate(`/players/${player.id}`)}
              className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent/50"
            >
              {/* Avatar / Shirt Number */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {player.shirtNumber ?? '?'}
              </div>

              {/* Name & Position */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {player.firstName} {player.lastName}
                  </p>
                  {!player.isActive && (
                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                  )}
                  {player.isGkVolunteer && (
                    <Badge variant="warning" className="text-xs">GK</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={POSITION_COLORS[player.primaryPosition] ?? 'secondary'} className="text-xs">
                    {POSITION_LABELS[player.primaryPosition] ?? player.primaryPosition}
                  </Badge>
                  {player.secondaryPosition && (
                    <span className="text-xs text-muted-foreground">
                      / {POSITION_LABELS[player.secondaryPosition] ?? player.secondaryPosition}
                    </span>
                  )}
                </div>
              </div>

              {/* Preferred foot indicator */}
              {player.preferredFoot && (
                <div className="hidden sm:block text-xs text-muted-foreground">
                  {player.preferredFoot === 'both' ? 'Both feet' : `${player.preferredFoot[0].toUpperCase()}${player.preferredFoot.slice(1)} foot`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAddPlayer }: { onAddPlayer: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <Users className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No players yet</h3>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
        Add your first player to start building your squad.
      </p>
      <Button onClick={onAddPlayer} className="mt-4">
        <Plus className="h-4 w-4" />
        Add Player
      </Button>
    </div>
  );
}
