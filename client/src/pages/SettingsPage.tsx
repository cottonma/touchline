import { useEffect } from 'react';
import { Shield, Clock, RotateCw, Target, BarChart3, Award, Bot, Compass } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { usePolicies, useUpdatePolicy, useSeedPolicies } from '@/hooks/use-policies';
import { parsePolicyValue, type Policy } from '@/services/policy.service';
import { TeamSetupCard } from '@/components/settings/TeamSetupCard';

/**
 * Settings page - Coaching Philosophy & Policy Engine.
 * Allows the coach to configure how the system generates recommendations.
 */
export function SettingsPage() {
  const { data: grouped, isLoading } = usePolicies();
  const updatePolicy = useUpdatePolicy();
  const seedPolicies = useSeedPolicies();

  // Auto-seed on first load if no policies exist
  useEffect(() => {
    if (grouped && Object.keys(grouped).length === 0) {
      seedPolicies.mutate();
    }
  }, [grouped]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (!grouped || Object.keys(grouped).length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Configure your coaching policies.</p>
        </div>
        <div className="text-center py-8">
          <Button onClick={() => seedPolicies.mutate()} disabled={seedPolicies.isPending}>
            {seedPolicies.isPending ? 'Setting up...' : 'Set Up Default Policies'}
          </Button>
        </div>
      </div>
    );
  }

  const handleUpdate = (category: string, key: string, value: unknown) => {
    updatePolicy.mutate({ category, key, value });
  };

  const getPolicy = (category: string, key: string): Policy | undefined => {
    return grouped[category]?.find((p) => p.key === key);
  };

  const getValue = <T,>(category: string, key: string, defaultValue: T): T => {
    const policy = getPolicy(category, key);
    return policy ? parsePolicyValue(policy, defaultValue) : defaultValue;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure how Touchline generates recommendations and manages your team.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Team Setup - format and formation */}
        <TeamSetupCard />

        {/* Coaching Philosophy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Coaching Philosophy</CardTitle>
            </div>
            <CardDescription>
              Your overall approach influences AI suggestions and team selection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Philosophy</Label>
              <Select
                value={getValue('philosophy', 'coaching_philosophy', 'development')}
                onChange={(e) => handleUpdate('philosophy', 'coaching_philosophy', e.target.value)}
              >
                <option value="development">Development First - Focus on learning and improving</option>
                <option value="balanced">Balanced - Compete while developing all players</option>
                <option value="competitive">Competitive - Aim to win while keeping it fair</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Playing Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Playing Time</CardTitle>
            </div>
            <CardDescription>
              Rules for equal playing time within matches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Equal time per match</Label>
                <p className="text-xs text-muted-foreground">Every available player gets the same outfield minutes</p>
              </div>
              <ToggleSwitch
                checked={getValue('playing_time', 'equal_time_per_match', true)}
                onChange={(v) => handleUpdate('playing_time', 'equal_time_per_match', v)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tolerance (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={getValue('playing_time', 'tolerance_minutes', 2)}
                  onChange={(e) => handleUpdate('playing_time', 'tolerance_minutes', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Max difference between players</p>
              </div>
              <div className="space-y-2">
                <Label>Max consecutive periods on bench</Label>
                <Input
                  type="number"
                  min={1}
                  max={3}
                  value={getValue('playing_time', 'max_consecutive_bench_periods', 1)}
                  onChange={(e) => handleUpdate('playing_time', 'max_consecutive_bench_periods', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">1 = must play every other period</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minimum sub playing time (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={getValue('playing_time', 'min_sub_minutes', 5)}
                onChange={(e) => handleUpdate('playing_time', 'min_sub_minutes', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">A player subbed on mid-quarter must get at least this many minutes</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Cross-match compensation</Label>
                <p className="text-xs text-muted-foreground">Give extra time to players who missed the previous match</p>
              </div>
              <ToggleSwitch
                checked={getValue('playing_time', 'cross_match_compensation', false)}
                onChange={(v) => handleUpdate('playing_time', 'cross_match_compensation', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Position Rotation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Position Rotation</CardTitle>
            </div>
            <CardDescription>
              How often players should experience different positions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Suggest rotation</Label>
                <p className="text-xs text-muted-foreground">Flag when a player hasn't rotated for a while</p>
              </div>
              <ToggleSwitch
                checked={getValue('positions', 'rotation_enabled', true)}
                onChange={(v) => handleUpdate('positions', 'rotation_enabled', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rotation frequency (weeks)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={getValue('positions', 'rotation_frequency_weeks', 6)}
                onChange={(e) => handleUpdate('positions', 'rotation_frequency_weeks', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Suggest rotation after this many weeks in the same position</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Prioritise primary position</Label>
                <p className="text-xs text-muted-foreground">Prefer player's main position in team selection</p>
              </div>
              <ToggleSwitch
                checked={getValue('positions', 'primary_position_priority', true)}
                onChange={(v) => handleUpdate('positions', 'primary_position_priority', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Goalkeeper */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Goalkeeper Rotation</CardTitle>
            </div>
            <CardDescription>
              How GK duty is shared across volunteers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-suggest next GK</Label>
                <p className="text-xs text-muted-foreground">Suggest who should play in goal based on rotation history</p>
              </div>
              <ToggleSwitch
                checked={getValue('goalkeeper', 'suggest_next_gk', true)}
                onChange={(v) => handleUpdate('goalkeeper', 'suggest_next_gk', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max GK periods per match</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={getValue('goalkeeper', 'max_gk_periods_per_match', 2)}
                onChange={(e) => handleUpdate('goalkeeper', 'max_gk_periods_per_match', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Maximum quarters a single player can be in goal</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>GK gets full outfield in other periods</Label>
                <p className="text-xs text-muted-foreground">Reward: GK plays every minute outfield when not in goal</p>
              </div>
              <ToggleSwitch
                checked={getValue('goalkeeper', 'gk_reward_full_outfield', true)}
                onChange={(v) => handleUpdate('goalkeeper', 'gk_reward_full_outfield', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Match Objective */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Match Objective</CardTitle>
            </div>
            <CardDescription>
              Default objective when not set per fixture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Default match objective</Label>
              <Select
                value={getValue('match_objective', 'default_objective', 'balanced')}
                onChange={(e) => handleUpdate('match_objective', 'default_objective', e.target.value)}
              >
                <option value="development">Development - Max rotation, try new positions</option>
                <option value="balanced">Balanced - Equal time, familiar positions</option>
                <option value="competitive">Competitive - Equal time, strongest positions</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Statistics</CardTitle>
            </div>
            <CardDescription>
              Control which statistics are tracked and displayed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show leaderboards</Label>
                <p className="text-xs text-muted-foreground">Display stat leaderboards (coach-only in MVP)</p>
              </div>
              <ToggleSwitch
                checked={getValue('statistics', 'show_leaderboards', true)}
                onChange={(v) => handleUpdate('statistics', 'show_leaderboards', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Track clean sheets</Label>
                <p className="text-xs text-muted-foreground">Award clean sheets to GKs and defenders</p>
              </div>
              <ToggleSwitch
                checked={getValue('statistics', 'track_clean_sheets', true)}
                onChange={(v) => handleUpdate('statistics', 'track_clean_sheets', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Clean sheet minimum periods</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={getValue('statistics', 'clean_sheet_min_periods', 2)}
                onChange={(e) => handleUpdate('statistics', 'clean_sheet_min_periods', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Defender must play this many periods to qualify</p>
            </div>
          </CardContent>
        </Card>

        {/* Recognition */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recognition & Milestones</CardTitle>
            </div>
            <CardDescription>
              Celebrate player achievements without harmful competition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Track milestones</Label>
                <p className="text-xs text-muted-foreground">10 appearances, first goal, first clean sheet, etc.</p>
              </div>
              <ToggleSwitch
                checked={getValue('recognition', 'milestones_enabled', true)}
                onChange={(v) => handleUpdate('recognition', 'milestones_enabled', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Behaviour */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Behaviour</CardTitle>
            </div>
            <CardDescription>
              Configure how the AI coaching assistant operates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>AI enabled</Label>
                <p className="text-xs text-muted-foreground">Enable AI-powered features</p>
              </div>
              <ToggleSwitch
                checked={getValue('ai_behaviour', 'enabled', true)}
                onChange={(v) => handleUpdate('ai_behaviour', 'enabled', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Response tone</Label>
              <Select
                value={getValue('ai_behaviour', 'tone', 'brief')}
                onChange={(e) => handleUpdate('ai_behaviour', 'tone', e.target.value)}
              >
                <option value="brief">Brief - Short, actionable responses</option>
                <option value="detailed">Detailed - Explanations with reasoning</option>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Philosophy-aware</Label>
                <p className="text-xs text-muted-foreground">AI aligns suggestions with your coaching philosophy</p>
              </div>
              <ToggleSwitch
                checked={getValue('ai_behaviour', 'philosophy_aware', true)}
                onChange={(v) => handleUpdate('ai_behaviour', 'philosophy_aware', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Suggest formation changes</Label>
                <p className="text-xs text-muted-foreground">Allow AI to suggest positional changes</p>
              </div>
              <ToggleSwitch
                checked={getValue('ai_behaviour', 'suggest_formation_changes', true)}
                onChange={(v) => handleUpdate('ai_behaviour', 'suggest_formation_changes', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Explain reasoning</Label>
                <p className="text-xs text-muted-foreground">AI explains why it made each suggestion</p>
              </div>
              <ToggleSwitch
                checked={getValue('ai_behaviour', 'explain_reasoning', true)}
                onChange={(v) => handleUpdate('ai_behaviour', 'explain_reasoning', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Simple toggle switch component.
 */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
