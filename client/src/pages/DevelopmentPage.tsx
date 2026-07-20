import { useState, useEffect } from 'react';
import { Plus, Target, MessageCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { usePlayers } from '@/hooks/use-players';
import { usePlayerDevelopment, useGoalLibrary, useCreateGoal, useUpdateGoalStatus, useAddObservation, useSeedLibrary } from '@/hooks/use-development';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { DevelopmentGoal, DevelopmentObservation } from '@/services/development.service';

const STATUS_LABELS: Record<string, string> = { working_on_it: 'Working on it', improving: 'Improving', achieved: 'Achieved' };
const STATUS_COLORS: Record<string, 'secondary' | 'warning' | 'success'> = { working_on_it: 'secondary', improving: 'warning', achieved: 'success' };
const CATEGORY_LABELS: Record<string, string> = { technical: 'Technical', tactical: 'Tactical', physical: 'Physical', psychological: 'Psychological' };
const POSITION_LABELS: Record<string, string> = { GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', CM: 'CM', LM: 'LM', RM: 'RM', CF: 'CF', all: 'All' };

/**
 * Player Development page.
 * Select a player → view/add goals → track progress with observations.
 */
export function DevelopmentPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>();
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [observationGoalId, setObservationGoalId] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [childId, setChildId] = useState<string | null>(null);

  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const { data: allPlayers } = usePlayers();

  // For parents, fetch their linked child and only show that player
  useEffect(() => {
    if (isParent) {
      api.get<any>('/parent/my-child').then((child) => {
        if (child?.id) {
          setChildId(child.id);
          setSelectedPlayerId(child.id);
        }
      }).catch(() => {});
    }
  }, [isParent]);

  const players = isParent
    ? (allPlayers?.filter(p => p.id === childId) ?? [])
    : (allPlayers ?? []);

  const { data: devData } = usePlayerDevelopment(selectedPlayerId);
  const { data: library } = useGoalLibrary();
  const createGoal = useCreateGoal();
  const updateStatus = useUpdateGoalStatus();
  const addObservation = useAddObservation();
  const seedLibrary = useSeedLibrary();

  // Auto-select first player (for coaches)
  useEffect(() => {
    if (!isParent && !selectedPlayerId && players && players.length > 0) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId, isParent]);

  // Auto-seed library if empty
  useEffect(() => {
    if (library && library.length === 0) {
      seedLibrary.mutate();
    }
  }, [library]);

  const handleAddGoal = (title: string, category: string, positionGroup: string) => {
    if (!selectedPlayerId) return;
    createGoal.mutate({ playerId: selectedPlayerId, data: { title, category, positionGroup } });
    setShowAddGoal(false);
  };

  const handleSubmitObservation = () => {
    if (!selectedPlayerId || !observationText.trim()) return;
    addObservation.mutate({
      playerId: selectedPlayerId,
      data: { observation: observationText, goalId: observationGoalId || undefined },
    });
    setObservationText('');
    setObservationGoalId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Development</h2>
        <p className="text-muted-foreground">Track player development goals and progress.</p>
      </div>

      {/* Player selector */}
      {players && players.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPlayerId(p.id); setShowAddGoal(false); }}
              className={`flex-shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedPlayerId === p.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
              }`}
            >
              {p.firstName} {p.lastName}
            </button>
          ))}
        </div>
      )}

      {selectedPlayerId && devData && (
        <>
          {/* Goals list */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Goals ({devData.goals.length})</h3>
            {!isParent && (
              <Button size="sm" variant="outline" onClick={() => setShowAddGoal(!showAddGoal)}>
                <Plus className="h-4 w-4" /> Add Goal
              </Button>
            )}
          </div>

          {!isParent && showAddGoal && (
            <AddGoalFromLibrary library={library ?? []} onAdd={handleAddGoal} onCancel={() => setShowAddGoal(false)} />
          )}

          {devData.goals.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No development goals yet. Add one from the library or create your own.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devData.goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  observations={devData.observations.filter((o) => o.goalId === goal.id)}
                  onStatusChange={(status) => updateStatus.mutate({ goalId: goal.id, status })}
                  onAddObservation={() => setObservationGoalId(goal.id)}
                  readOnly={isParent}
                />
              ))}
            </div>
          )}

          {/* Add observation form — coaches only */}
          {!isParent && observationGoalId && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Observation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="What did you observe?"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitObservation} disabled={!observationText.trim()}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setObservationGoalId(null); setObservationText(''); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  observations,
  onStatusChange,
  onAddObservation,
  readOnly = false,
}: {
  goal: DevelopmentGoal;
  observations: DevelopmentObservation[];
  onStatusChange: (status: string) => void;
  onAddObservation: () => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{goal.title}</span>
              <Badge variant={STATUS_COLORS[goal.status]} className="text-xs">
                {STATUS_LABELS[goal.status]}
              </Badge>
              {goal.status === 'achieved' && <span className="text-base">🏆</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{CATEGORY_LABELS[goal.category]}</span>
              <span>·</span>
              <span>{POSITION_LABELS[goal.positionGroup] ?? goal.positionGroup}</span>
            </div>
          </div>

          {/* Status selector — coaches only */}
          {!readOnly && (
            <Select
              value={goal.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-32 h-8 text-xs"
            >
              <option value="working_on_it">Working on it</option>
              <option value="improving">Improving</option>
              <option value="achieved">Achieved</option>
            </Select>
          )}
        </div>

        {/* Observation controls — coaches only */}
        {!readOnly && (
          <div className="flex items-center gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={onAddObservation} className="text-xs h-7">
              <MessageCircle className="h-3 w-3" /> Add Observation
            </Button>
          </div>
        )}

        {/* Observations toggle — visible to all */}
        <div className="flex items-center gap-2 mt-2">
          {observations.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs h-7">
              {observations.length} observation{observations.length !== 1 ? 's' : ''}
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </Button>
          )}
        </div>

        {/* Observations list */}
        {expanded && observations.length > 0 && (
          <div className="mt-3 space-y-2 pl-3 border-l-2 border-muted">
            {observations.map((obs) => (
              <div key={obs.id} className="text-xs">
                <p className="text-foreground">{obs.observation}</p>
                <p className="text-muted-foreground mt-0.5">
                  {new Date(obs.observedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddGoalFromLibrary({
  library,
  onAdd,
  onCancel,
}: {
  library: { category: string; positionGroup: string; title: string }[];
  onAdd: (title: string, category: string, positionGroup: string) => void;
  onCancel: () => void;
}) {
  const [filterPosition, setFilterPosition] = useState('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  const filtered = library.filter((g) => {
    if (filterPosition && filterPosition !== 'all' && g.positionGroup !== filterPosition && g.positionGroup !== 'all') return false;
    if (filterCategory && g.category !== filterCategory) return false;
    return true;
  });

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Add Development Goal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-2 grid-cols-2">
          <div>
            <Label className="text-xs">Position</Label>
            <Select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="h-8 text-xs">
              <option value="all">All Positions</option>
              <option value="GK">Goalkeeper (GK)</option>
              <option value="CB">Centre Back (CB)</option>
              <option value="LB">Left Back (LB)</option>
              <option value="RB">Right Back (RB)</option>
              <option value="CM">Central Midfield (CM)</option>
              <option value="LM">Left Midfield (LM)</option>
              <option value="RM">Right Midfield (RM)</option>
              <option value="CF">Centre Forward (CF)</option>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-8 text-xs">
              <option value="">All Categories</option>
              <option value="technical">Technical</option>
              <option value="tactical">Tactical</option>
              <option value="physical">Physical</option>
              <option value="psychological">Psychological</option>
            </Select>
          </div>
        </div>

        {/* Library items */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filtered.slice(0, 15).map((item, i) => (
            <button
              key={i}
              onClick={() => onAdd(item.title, item.category, item.positionGroup)}
              className="w-full text-left text-xs rounded-md px-3 py-2 hover:bg-accent transition-colors"
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground ml-2">({CATEGORY_LABELS[item.category]})</span>
            </button>
          ))}
        </div>

        {/* Custom goal */}
        <div className="border-t pt-3">
          <Label className="text-xs">Or type a custom goal</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Improve weaker foot passing"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!customTitle.trim()}
              onClick={() => { onAdd(customTitle, filterCategory || 'technical', filterPosition || 'all'); setCustomTitle(''); }}
            >
              Add
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onCancel} className="w-full">Cancel</Button>
      </CardContent>
    </Card>
  );
}
