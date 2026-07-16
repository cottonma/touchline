import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Save, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFixtures } from '@/hooks/use-fixtures';
import { useScoutReports, useCreateScoutReport, useUpdateScoutReport } from '@/hooks/use-scout-reports';
import type { KeyPlayer } from '@/services/scout-report.service';

// ---- Constants ----
const STYLE_OPTIONS = [
  'Play out from back', 'Long kicks from GK', 'Strong dribbling',
  'Fast counter attacks', 'Physical team', 'Strong passing', 'Relies on individuals', 'Other',
];

const CHANCE_CREATION_OPTIONS = [
  'Dribbling', 'Through balls', 'Long kicks', 'Corners', 'Free kicks', 'Mistakes from opponents',
];

const DEFENSIVE_STYLE_OPTIONS = [
  'Press high', 'Stay deep', 'Man mark', 'Protect centre', 'Leave space wide', 'Leave space behind defence',
];

const WEAKNESS_OPTIONS = [
  'Slow defenders', 'GK distribution weak', 'Struggle against pace',
  'Struggle against passing', 'Poor tracking runners', 'Poor defending corners', 'Poor defending throw-ins',
];

const FORMATION_OPTIONS = ['2-3-1', '3-2-1', '2-1-2-1', 'Other'];

const CONFIDENCE_OPTIONS = [
  { value: 'very_difficult', label: 'Very Difficult', color: 'bg-red-500' },
  { value: 'difficult', label: 'Difficult', color: 'bg-orange-500' },
  { value: 'competitive', label: 'Competitive', color: 'bg-yellow-500' },
  { value: 'favourable', label: 'Favourable', color: 'bg-lime-500' },
  { value: 'very_favourable', label: 'Very Favourable', color: 'bg-green-500' },
];

// ---- Form State Interface ----
interface FormState {
  fixtureId: string | null;
  opponent: string;
  scoutName: string;
  date: string;
  finalScore: string;
  formation: string;
  formationOther: string;
  styleOfPlay: string[];
  keyPlayers: KeyPlayer[];
  attackDirection: string;
  chanceCreation: string[];
  attackingNotes: string;
  defensiveStyle: string[];
  weaknesses: string[];
  defensiveNotes: string;
  cornersRating: string;
  gkRating: string;
  gkDistribution: string;
  setPieceNotes: string;
  threats: string[];
  opportunities: string[];
  attackBy: string;
  defendBy: string;
  confidenceRating: string;
  overallComments: string;
  teamPerformanceRating: number;
  teamStrengths: string;
  teamWeaknesses: string;
  teamNotes: string;
}

const DEFAULT_FORM: FormState = {
  fixtureId: null,
  opponent: '',
  scoutName: '',
  date: '',
  finalScore: '',
  formation: '',
  formationOther: '',
  styleOfPlay: [],
  keyPlayers: [{ name: '', position: '', strengths: '', threatLevel: 0 }],
  attackDirection: '',
  chanceCreation: [],
  attackingNotes: '',
  defensiveStyle: [],
  weaknesses: [],
  defensiveNotes: '',
  cornersRating: '',
  gkRating: '',
  gkDistribution: '',
  setPieceNotes: '',
  threats: ['', '', ''],
  opportunities: ['', '', ''],
  attackBy: '',
  defendBy: '',
  confidenceRating: '',
  overallComments: '',
  teamPerformanceRating: 5,
  teamStrengths: '',
  teamWeaknesses: '',
  teamNotes: '',
};

// ---- Collapsible Section Component ----
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/50">
      <CardHeader className="cursor-pointer py-3 px-4" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

// ---- Checkbox Group ----
function CheckboxGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            selected.includes(opt) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
          }`}>{opt}</button>
      ))}
    </div>
  );
}

// ---- Radio Group ----
function RadioGroup({ options, value, onChange, colored }: { options: { value: string; label: string; color?: string }[]; value: string; onChange: (v: string) => void; colored?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
          }`}>
          {colored && opt.color && <span className={`inline-block h-2.5 w-2.5 rounded-full ${opt.color}`} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---- Main Page Component ----
export function ScoutReportPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('');

  const { data: fixtures } = useFixtures();
  const { data: reports } = useScoutReports(selectedFixtureId ? { fixtureId: selectedFixtureId } : undefined);
  const createReport = useCreateScoutReport();
  const updateReport = useUpdateScoutReport();

  // When a fixture is selected, auto-populate opponent and date
  useEffect(() => {
    if (selectedFixtureId && fixtures) {
      const fixture = fixtures.find(f => f.id === selectedFixtureId);
      if (fixture && !editingId) {
        setForm(prev => ({
          ...prev,
          fixtureId: fixture.id,
          opponent: fixture.opponent || '',
          date: fixture.date || '',
        }));
      }
    }
  }, [selectedFixtureId, fixtures, editingId]);

  // Load existing report for editing
  useEffect(() => {
    if (reports && reports.length > 0 && selectedFixtureId) {
      const existing = reports[0];
      setEditingId(existing.id);
      setForm({
        fixtureId: existing.fixtureId,
        opponent: existing.opponent || '',
        scoutName: existing.scoutName || '',
        date: existing.date || '',
        finalScore: existing.finalScore || '',
        formation: existing.formation || '',
        formationOther: FORMATION_OPTIONS.includes(existing.formation || '') ? '' : (existing.formation || ''),
        styleOfPlay: safeParseJson(existing.styleOfPlay, []),
        keyPlayers: safeParseJson(existing.keyPlayers, [{ name: '', position: '', strengths: '', threatLevel: 0 }]),
        attackDirection: existing.attackDirection || '',
        chanceCreation: safeParseJson(existing.chanceCreation, []),
        attackingNotes: existing.attackingNotes || '',
        defensiveStyle: safeParseJson(existing.defensiveStyle, []),
        weaknesses: safeParseJson(existing.weaknesses, []),
        defensiveNotes: existing.defensiveNotes || '',
        cornersRating: existing.cornersRating || '',
        gkRating: existing.gkRating || '',
        gkDistribution: existing.gkDistribution || '',
        setPieceNotes: existing.setPieceNotes || '',
        threats: safeParseJson(existing.threats, ['', '', '']),
        opportunities: safeParseJson(existing.opportunities, ['', '', '']),
        attackBy: existing.attackBy || '',
        defendBy: existing.defendBy || '',
        confidenceRating: existing.confidenceRating || '',
        overallComments: existing.overallComments || '',
        teamPerformanceRating: existing.teamPerformanceRating || 5,
        teamStrengths: existing.teamStrengths || '',
        teamWeaknesses: existing.teamWeaknesses || '',
        teamNotes: existing.teamNotes || '',
      });
    } else if (!selectedFixtureId || (reports && reports.length === 0)) {
      setEditingId(null);
    }
  }, [reports, selectedFixtureId]);

  const handleSave = () => {
    const payload = {
      fixtureId: form.fixtureId,
      opponent: form.opponent,
      scoutName: form.scoutName || null,
      date: form.date || null,
      finalScore: form.finalScore || null,
      formation: form.formation === 'Other' ? form.formationOther : form.formation || null,
      styleOfPlay: JSON.stringify(form.styleOfPlay),
      keyPlayers: JSON.stringify(form.keyPlayers.filter(p => p.name)),
      attackDirection: form.attackDirection || null,
      chanceCreation: JSON.stringify(form.chanceCreation),
      attackingNotes: form.attackingNotes || null,
      defensiveStyle: JSON.stringify(form.defensiveStyle),
      weaknesses: JSON.stringify(form.weaknesses),
      defensiveNotes: form.defensiveNotes || null,
      cornersRating: form.cornersRating || null,
      gkRating: form.gkRating || null,
      gkDistribution: form.gkDistribution || null,
      setPieceNotes: form.setPieceNotes || null,
      threats: JSON.stringify(form.threats),
      opportunities: JSON.stringify(form.opportunities),
      attackBy: form.attackBy || null,
      defendBy: form.defendBy || null,
      confidenceRating: form.confidenceRating || null,
      overallComments: form.overallComments || null,
      teamPerformanceRating: form.teamPerformanceRating,
      teamStrengths: form.teamStrengths || null,
      teamWeaknesses: form.teamWeaknesses || null,
      teamNotes: form.teamNotes || null,
    };

    if (editingId) {
      updateReport.mutate({ id: editingId, data: payload });
    } else {
      createReport.mutate(payload as any, {
        onSuccess: (res) => { setEditingId(res.data.id); },
      });
    }
  };

  const handleNewReport = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, fixtureId: selectedFixtureId || null });
  };

  const update = (partial: Partial<FormState>) => setForm(prev => ({ ...prev, ...partial }));

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6" /> Scout Report
          </h2>
          <p className="text-muted-foreground text-sm">Opposition analysis and match preparation</p>
        </div>
        <button onClick={handleNewReport}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      {/* Fixture Selector */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Fixture</label>
          <select value={selectedFixtureId} onChange={e => { setSelectedFixtureId(e.target.value); setEditingId(null); setForm(DEFAULT_FORM); }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">— Choose a fixture —</option>
            {fixtures?.filter(f => f.type === 'match' || f.type === 'friendly' || f.type === 'tournament')
              .map(f => (
                <option key={f.id} value={f.id}>
                  {f.homeAway === 'home' ? 'vs' : '@'} {f.opponent} — {formatDate(f.date)}
                </option>
              ))}
          </select>
        </CardContent>
      </Card>

      {/* Meta fields */}
      <Card className="border-border/50">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Opponent</label>
            <input value={form.opponent} onChange={e => update({ opponent: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Team name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Scout Name</label>
            <input value={form.scoutName} onChange={e => update({ scoutName: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Your name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input type="date" value={form.date} onChange={e => update({ date: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Final Score</label>
            <input value={form.finalScore} onChange={e => update({ finalScore: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. 3-2" />
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Team Overview */}
      <Section title="1. Team Overview">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Formation</label>
            <RadioGroup
              options={FORMATION_OPTIONS.map(f => ({ value: f, label: f }))}
              value={form.formation}
              onChange={v => update({ formation: v })}
            />
            {form.formation === 'Other' && (
              <input value={form.formationOther} onChange={e => update({ formationOther: e.target.value })}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Describe formation" />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Style of Play</label>
            <CheckboxGroup options={STYLE_OPTIONS} selected={form.styleOfPlay} onChange={v => update({ styleOfPlay: v })} />
          </div>
        </div>
      </Section>

      {/* Section 2: Key Players */}
      <Section title="2. Key Players">
        <div className="space-y-3">
          {form.keyPlayers.map((player, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border/50 p-3">
              <div className="grid grid-cols-2 gap-2">
                <input value={player.name} onChange={e => {
                  const updated = [...form.keyPlayers];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  update({ keyPlayers: updated });
                }} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" placeholder="Name / Shirt #" />
                <input value={player.position} onChange={e => {
                  const updated = [...form.keyPlayers];
                  updated[idx] = { ...updated[idx], position: e.target.value };
                  update({ keyPlayers: updated });
                }} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" placeholder="Position" />
                <input value={player.strengths} onChange={e => {
                  const updated = [...form.keyPlayers];
                  updated[idx] = { ...updated[idx], strengths: e.target.value };
                  update({ keyPlayers: updated });
                }} className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs" placeholder="Key strengths" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Threat</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => {
                      const updated = [...form.keyPlayers];
                      updated[idx] = { ...updated[idx], threatLevel: n };
                      update({ keyPlayers: updated });
                    }} className={`h-6 w-6 rounded text-xs font-bold ${player.threatLevel >= n ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>{n}</button>
                  ))}
                </div>
                {form.keyPlayers.length > 1 && (
                  <button type="button" onClick={() => update({ keyPlayers: form.keyPlayers.filter((_, i) => i !== idx) })}
                    className="text-muted-foreground hover:text-red-500 mt-1"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => update({ keyPlayers: [...form.keyPlayers, { name: '', position: '', strengths: '', threatLevel: 0 }] })}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add player
          </button>
        </div>
      </Section>

      {/* Section 3: Attacking Threat */}
      <Section title="3. Attacking Threat">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Where do attacks come from?</label>
            <RadioGroup
              options={[{ value: 'left', label: 'Left' }, { value: 'centre', label: 'Centre' }, { value: 'right', label: 'Right' }, { value: 'even', label: 'Even' }]}
              value={form.attackDirection}
              onChange={v => update({ attackDirection: v })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What creates chances?</label>
            <CheckboxGroup options={CHANCE_CREATION_OPTIONS} selected={form.chanceCreation} onChange={v => update({ chanceCreation: v })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea value={form.attackingNotes} onChange={e => update({ attackingNotes: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Observations..." />
          </div>
        </div>
      </Section>

      {/* Section 4: Defensive Observations */}
      <Section title="4. Defensive Observations">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Defensive Style</label>
            <CheckboxGroup options={DEFENSIVE_STYLE_OPTIONS} selected={form.defensiveStyle} onChange={v => update({ defensiveStyle: v })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Weaknesses</label>
            <CheckboxGroup options={WEAKNESS_OPTIONS} selected={form.weaknesses} onChange={v => update({ weaknesses: v })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea value={form.defensiveNotes} onChange={e => update({ defensiveNotes: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Observations..." />
          </div>
        </div>
      </Section>

      {/* Section 5: Set Pieces */}
      <Section title="5. Set Pieces">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Corners</label>
            <RadioGroup
              options={[{ value: 'dangerous', label: 'Dangerous' }, { value: 'average', label: 'Average' }, { value: 'weak', label: 'Weak' }]}
              value={form.cornersRating} onChange={v => update({ cornersRating: v })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Goalkeeper</label>
            <RadioGroup
              options={[{ value: 'strong', label: 'Strong' }, { value: 'average', label: 'Average' }, { value: 'weak', label: 'Weak' }]}
              value={form.gkRating} onChange={v => update({ gkRating: v })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">GK Distribution</label>
            <RadioGroup
              options={[{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }, { value: 'mixed', label: 'Mixed' }]}
              value={form.gkDistribution} onChange={v => update({ gkDistribution: v })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea value={form.setPieceNotes} onChange={e => update({ setPieceNotes: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Set piece observations..." />
          </div>
        </div>
      </Section>

      {/* Section 6: Threats & Opportunities */}
      <Section title="6. Threats & Opportunities">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Three Biggest Threats</label>
            {form.threats.map((t, i) => (
              <input key={i} value={t} onChange={e => {
                const updated = [...form.threats];
                updated[i] = e.target.value;
                update({ threats: updated });
              }} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2" placeholder={`Threat ${i + 1}`} />
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Three Opportunities For Us</label>
            {form.opportunities.map((t, i) => (
              <input key={i} value={t} onChange={e => {
                const updated = [...form.opportunities];
                updated[i] = e.target.value;
                update({ opportunities: updated });
              }} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2" placeholder={`Opportunity ${i + 1}`} />
            ))}
          </div>
        </div>
      </Section>

      {/* Section 7: Match Preparation Summary */}
      <Section title="7. Match Preparation Summary">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">How we can ATTACK them</label>
            <textarea value={form.attackBy} onChange={e => update({ attackBy: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Our plan to attack..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">How we need to DEFEND</label>
            <textarea value={form.defendBy} onChange={e => update({ defendBy: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Our defensive plan..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Confidence Rating</label>
            <RadioGroup options={CONFIDENCE_OPTIONS} value={form.confidenceRating} onChange={v => update({ confidenceRating: v })} colored />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Overall Comments</label>
            <textarea value={form.overallComments} onChange={e => update({ overallComments: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="General thoughts..." />
          </div>
        </div>
      </Section>

      {/* Section 8: How We Played */}
      <Section title="8. How We Played" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Team Performance: {form.teamPerformanceRating}/10
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => update({ teamPerformanceRating: n })}
                  className={`h-8 w-8 rounded text-xs font-bold transition-colors ${
                    form.teamPerformanceRating >= n
                      ? n <= 3 ? 'bg-red-500 text-white'
                        : n <= 6 ? 'bg-yellow-500 text-white'
                        : 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What we did well</label>
            <textarea value={form.teamStrengths} onChange={e => update({ teamStrengths: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Strengths..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What we need to improve</label>
            <textarea value={form.teamWeaknesses} onChange={e => update({ teamWeaknesses: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Areas to improve..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">General Notes</label>
            <textarea value={form.teamNotes} onChange={e => update({ teamNotes: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Any other notes..." />
          </div>
        </div>
      </Section>

      {/* Save Button - Sticky at bottom for mobile */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border md:static md:border-0 md:p-0 md:bg-transparent">
        <button onClick={handleSave}
          disabled={!form.opponent || createReport.isPending || updateReport.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {createReport.isPending || updateReport.isPending ? 'Saving...' : editingId ? 'Update Report' : 'Save Report'}
        </button>
      </div>
    </div>
  );
}

// ---- Helpers ----
function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return dateStr; }
}
