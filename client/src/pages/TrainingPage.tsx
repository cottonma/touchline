import { useState } from 'react';
import { Plus, Dumbbell, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrainingSessions, useCreateTraining, useDeleteTraining } from '@/hooks/use-training';
import type { TrainingBlock, TrainingSession } from '@/services/training.service';

const BLOCK_TYPES = [
  { value: 'warm_up', label: 'Warm Up' },
  { value: 'technical_drill', label: 'Technical Drill' },
  { value: 'tactical_drill', label: 'Tactical Drill' },
  { value: 'small_sided_game', label: 'Small-Sided Game' },
  { value: 'match', label: 'Match / Scrimmage' },
  { value: 'cool_down', label: 'Cool Down' },
  { value: 'discussion', label: 'Discussion / Debrief' },
];

const BLOCK_COLORS: Record<string, string> = {
  warm_up: 'bg-orange-100 text-orange-800',
  technical_drill: 'bg-blue-100 text-blue-800',
  tactical_drill: 'bg-purple-100 text-purple-800',
  small_sided_game: 'bg-green-100 text-green-800',
  match: 'bg-emerald-100 text-emerald-800',
  cool_down: 'bg-cyan-100 text-cyan-800',
  discussion: 'bg-gray-100 text-gray-800',
};

/**
 * Training page - plan sessions with flexible blocks, track themes and notes.
 */
export function TrainingPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: sessions, isLoading } = useTrainingSessions();
  const deleteTraining = useDeleteTraining();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Training</h2>
          <p className="text-muted-foreground">Plan training sessions and track attendance.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Session</span>
        </Button>
      </div>

      {showForm && (
        <TrainingForm onClose={() => setShowForm(false)} onSuccess={() => setShowForm(false)} />
      )}

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading sessions...</div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No training sessions</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create your first training session plan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={() => deleteTraining.mutate(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onDelete }: { session: TrainingSession; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalDuration = session.parsedPlan.reduce((sum, b) => sum + b.duration, 0);

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{session.theme || 'Untitled Session'}</CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{totalDuration} min</span>
              <span>·</span>
              <span>{session.parsedPlan.length} blocks</span>
              <span>·</span>
              <span>{new Date(session.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Objectives */}
          {session.parsedObjectives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Objectives</p>
              <ul className="space-y-1">
                {session.parsedObjectives.map((obj, i) => (
                  <li key={i} className="text-sm">• {obj}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan blocks */}
          {session.parsedPlan.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Session Plan</p>
              {session.parsedPlan.map((block, i) => (
                <div key={i} className="flex items-start gap-3 text-sm rounded-md border p-3">
                  <Badge className={`text-[10px] shrink-0 ${BLOCK_COLORS[block.type] ?? 'bg-gray-100'}`}>
                    {block.duration}m
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{block.title}</p>
                    {block.description && <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>}
                    {block.coachingPoints && <p className="text-xs text-primary mt-1">Points: {block.coachingPoints}</p>}
                    {block.equipment && <p className="text-xs text-muted-foreground">Equipment: {block.equipment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{session.notes}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TrainingForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [theme, setTheme] = useState('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [blocks, setBlocks] = useState<TrainingBlock[]>([
    { type: 'warm_up', title: '', duration: 10 },
  ]);
  const [notes, setNotes] = useState('');

  const createTraining = useCreateTraining();

  const addBlock = () => {
    setBlocks([...blocks, { type: 'technical_drill', title: '', duration: 15 }]);
  };

  const removeBlock = (idx: number) => {
    setBlocks(blocks.filter((_, i) => i !== idx));
  };

  const updateBlock = (idx: number, field: keyof TrainingBlock, value: string | number) => {
    const updated = [...blocks];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setBlocks(updated);
  };

  const handleSubmit = async () => {
    const filteredObjectives = objectives.filter((o) => o.trim());
    const filteredBlocks = blocks.filter((b) => b.title.trim());

    await createTraining.mutateAsync({
      theme: theme || undefined,
      objectives: filteredObjectives.length > 0 ? filteredObjectives : undefined,
      plan: filteredBlocks.length > 0 ? filteredBlocks : undefined,
      notes: notes || undefined,
    });
    onSuccess();
  };

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="text-base">New Training Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Theme */}
        <div className="space-y-2">
          <Label>Theme</Label>
          <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Passing under pressure" />
        </div>

        {/* Objectives */}
        <div className="space-y-2">
          <Label>Objectives</Label>
          {objectives.map((obj, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={obj}
                onChange={(e) => { const updated = [...objectives]; updated[i] = e.target.value; setObjectives(updated); }}
                placeholder={`Objective ${i + 1}`}
                className="h-8 text-sm"
              />
              {objectives.length > 1 && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setObjectives([...objectives, ''])}>
            <Plus className="h-3 w-3" /> Add Objective
          </Button>
        </div>

        {/* Session blocks */}
        <div className="space-y-3">
          <Label>Session Plan</Label>
          {blocks.map((block, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <Select value={block.type} onChange={(e) => updateBlock(i, 'type', e.target.value)} className="h-8 text-xs w-40">
                  {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
                <Input
                  value={block.duration}
                  type="number"
                  min={1}
                  max={60}
                  onChange={(e) => updateBlock(i, 'duration', Number(e.target.value))}
                  className="h-8 w-16 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground">min</span>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="h-7" onClick={() => removeBlock(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={block.title}
                onChange={(e) => updateBlock(i, 'title', e.target.value)}
                placeholder="Activity name"
                className="h-8 text-sm"
              />
              <Input
                value={block.description ?? ''}
                onChange={(e) => updateBlock(i, 'description', e.target.value)}
                placeholder="Description (optional)"
                className="h-8 text-xs"
              />
              <Input
                value={block.coachingPoints ?? ''}
                onChange={(e) => updateBlock(i, 'coachingPoints', e.target.value)}
                placeholder="Coaching points (optional)"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addBlock}>
            <Plus className="h-3 w-3" /> Add Block
          </Button>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createTraining.isPending}>
            {createTraining.isPending ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
