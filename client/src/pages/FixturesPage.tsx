import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFixtures } from '@/hooks/use-fixtures';
import { FixtureForm } from '@/components/fixtures/FixtureForm';
import type { Fixture } from '@/services/fixture.service';

const TYPE_LABELS: Record<string, string> = {
  match: 'Match',
  training: 'Training',
  friendly: 'Friendly',
  tournament: 'Tournament',
};

const TYPE_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info'> = {
  match: 'default',
  training: 'info',
  friendly: 'success',
  tournament: 'warning',
};

type FilterTab = 'all' | 'upcoming' | 'completed';

/**
 * Fixtures page - displays all fixtures with filtering by status.
 */
export function FixturesPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  const navigate = useNavigate();

  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: fixtures, isLoading, error } = useFixtures(
    statusFilter ? { status: statusFilter } : undefined
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading fixtures...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">Error loading fixtures: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fixtures</h2>
          <p className="text-muted-foreground">
            {fixtures?.length ?? 0} fixture{fixtures?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Fixture</span>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(['upcoming', 'completed', 'all'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Add Fixture Form */}
      {showForm && (
        <FixtureForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {/* Fixture List */}
      {!fixtures || fixtures.length === 0 ? (
        <EmptyState tab={activeTab} onAddFixture={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-3">
          {fixtures.map((fixture) => (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              onClick={() => navigate(`/fixtures/${fixture.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureCard({ fixture, onClick }: { fixture: Fixture; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent/50"
    >
      {/* Date */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <span className="text-xs text-muted-foreground uppercase">
          {formatDay(fixture.date)}
        </span>
        <span className="text-lg font-bold">
          {formatDateNum(fixture.date)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatMonth(fixture.date)}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {fixture.type === 'training'
              ? 'Training Session'
              : `${fixture.homeAway === 'home' ? 'vs' : '@'} ${fixture.opponent}`}
          </p>
          {fixture.status === 'cancelled' && (
            <Badge variant="outline" className="text-xs line-through">Cancelled</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
          {fixture.kickOffTime && <span>{fixture.kickOffTime}</span>}
          {fixture.location && (
            <>
              {fixture.kickOffTime && <span>·</span>}
              <span className="truncate">{fixture.location}</span>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="hidden sm:flex flex-col items-end gap-1">
        <Badge variant={TYPE_COLORS[fixture.type]} className="text-xs">
          {TYPE_LABELS[fixture.type]}
        </Badge>
        {fixture.matchObjective && (
          <span className="text-xs text-muted-foreground capitalize">
            {fixture.matchObjective}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab, onAddFixture }: { tab: FilterTab; onAddFixture: () => void }) {
  const messages: Record<FilterTab, string> = {
    upcoming: 'No upcoming fixtures. Add your next match or training session.',
    completed: 'No completed fixtures yet. Results will appear here after matches.',
    all: 'No fixtures yet. Add your first match or training session to get started.',
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <Calendar className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No fixtures</h3>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
        {messages[tab]}
      </p>
      <Button onClick={onAddFixture} className="mt-4">
        <Plus className="h-4 w-4" />
        Add Fixture
      </Button>
    </div>
  );
}

// Date formatting helpers
function formatDay(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  } catch { return ''; }
}

function formatDateNum(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').getDate().toString();
  } catch { return ''; }
}

function formatMonth(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
  } catch { return ''; }
}
