import { useState } from 'react';
import { Check, X, HelpCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFixtures } from '@/hooks/use-fixtures';
import { useFixtureAvailability, useUpdateAvailability } from '@/hooks/use-availability';
import type { Fixture } from '@/services/fixture.service';
import type { AvailabilityRecord } from '@/services/availability.service';

type AvailabilityStatus = 'available' | 'unavailable' | 'unknown';

/**
 * Availability Tracking page.
 * Coach selects an upcoming fixture and quickly marks each player's availability.
 * Designed for fast, one-tap updates.
 */
export function AvailabilityPage() {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | undefined>();

  // Get upcoming fixtures for selection
  const { data: fixtures, isLoading: fixturesLoading } = useFixtures({ status: 'upcoming' });

  // Auto-select first fixture if none selected
  if (!selectedFixtureId && fixtures && fixtures.length > 0) {
    setSelectedFixtureId(fixtures[0].id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Availability</h2>
        <p className="text-muted-foreground">
          Record who is available for upcoming fixtures.
        </p>
      </div>

      {fixturesLoading ? (
        <div className="text-muted-foreground">Loading fixtures...</div>
      ) : !fixtures || fixtures.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Fixture selector */}
          <FixtureSelector
            fixtures={fixtures}
            selectedId={selectedFixtureId}
            onSelect={setSelectedFixtureId}
          />

          {/* Availability grid */}
          {selectedFixtureId && (
            <AvailabilityGrid fixtureId={selectedFixtureId} />
          )}
        </>
      )}
    </div>
  );
}

function FixtureSelector({
  fixtures,
  selectedId,
  onSelect,
}: {
  fixtures: Fixture[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {fixtures.map((fixture) => (
        <button
          key={fixture.id}
          onClick={() => onSelect(fixture.id)}
          className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors ${
            selectedId === fixture.id
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-border hover:bg-accent'
          }`}
        >
          <div className="font-medium">
            {fixture.type === 'training'
              ? 'Training'
              : fixture.opponent}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatShortDate(fixture.date)}
          </div>
        </button>
      ))}
    </div>
  );
}

function AvailabilityGrid({ fixtureId }: { fixtureId: string }) {
  const { data, isLoading } = useFixtureAvailability(fixtureId);
  const updateAvailability = useUpdateAvailability();

  if (isLoading) {
    return <div className="text-muted-foreground">Loading availability...</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground">No data available.</div>;
  }

  const { data: players, summary } = data;

  const handleToggle = (playerId: string, currentStatus: AvailabilityStatus) => {
    // Cycle through: unknown -> available -> unavailable -> unknown
    const nextStatus: Record<AvailabilityStatus, AvailabilityStatus> = {
      unknown: 'available',
      available: 'unavailable',
      unavailable: 'unknown',
    };

    updateAvailability.mutate({
      fixtureId,
      playerId,
      status: nextStatus[currentStatus],
    });
  };

  const handleSetStatus = (playerId: string, status: AvailabilityStatus) => {
    updateAvailability.mutate({ fixtureId, playerId, status });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3">
        <Badge variant="success" className="gap-1">
          <Check className="h-3 w-3" /> {summary.available} available
        </Badge>
        <Badge variant="destructive" className="gap-1">
          <X className="h-3 w-3" /> {summary.unavailable} unavailable
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <HelpCircle className="h-3 w-3" /> {summary.unknown} unknown
        </Badge>
      </div>

      {/* Player list with availability toggles */}
      <div className="grid gap-2">
        {players.map((record) => (
          <PlayerAvailabilityRow
            key={record.playerId}
            record={record}
            onToggle={handleToggle}
            onSetStatus={handleSetStatus}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerAvailabilityRow({
  record,
  onToggle,
  onSetStatus,
}: {
  record: AvailabilityRecord;
  onToggle: (playerId: string, status: AvailabilityStatus) => void;
  onSetStatus: (playerId: string, status: AvailabilityStatus) => void;
}) {
  const status = record.status as AvailabilityStatus;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {/* Player name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {record.playerFirstName} {record.playerLastName}
        </p>
        {record.reason && (
          <p className="text-xs text-muted-foreground truncate">{record.reason}</p>
        )}
      </div>

      {/* Status buttons - three options for quick selection */}
      <div className="flex gap-1">
        <button
          onClick={() => onSetStatus(record.playerId, 'available')}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            status === 'available'
              ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
              : 'bg-muted text-muted-foreground hover:bg-green-50 hover:text-green-600'
          }`}
          title="Available"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSetStatus(record.playerId, 'unavailable')}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            status === 'unavailable'
              ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
              : 'bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600'
          }`}
          title="Unavailable"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSetStatus(record.playerId, 'unknown')}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            status === 'unknown'
              ? 'bg-gray-200 text-gray-700 ring-2 ring-gray-400'
              : 'bg-muted text-muted-foreground hover:bg-gray-100'
          }`}
          title="Unknown"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <Calendar className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No upcoming fixtures</h3>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
        Add a fixture first, then you can record player availability.
      </p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}
