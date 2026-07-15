import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PitchPreview } from '@/components/settings/PitchPreview';

/**
 * Format defaults: match duration, periods, and max squad size
 */
const FORMAT_DEFAULTS: Record<string, { matchDurationMinutes: number; periods: number; maxSquadSize: number; description: string }> = {
  '5v5': { matchDurationMinutes: 40, periods: 4, maxSquadSize: 8, description: '4 outfield + GK. Fast-paced, lots of touches. Typical for U7–U8.' },
  '7v7': { matchDurationMinutes: 48, periods: 4, maxSquadSize: 12, description: '6 outfield + GK. Balanced play with positions. Typical for U9–U10.' },
  '9v9': { matchDurationMinutes: 60, periods: 2, maxSquadSize: 14, description: '8 outfield + GK. Wider pitch, more structure. Typical for U11–U12.' },
  '11v11': { matchDurationMinutes: 70, periods: 2, maxSquadSize: 16, description: 'Full-size game. Typical for U13+.' },
};

/**
 * Formation presets by format
 */
const FORMATION_PRESETS: Record<string, string[]> = {
  '5v5': ['1-2-1', '2-1-1', '1-1-2', '2-2'],
  '7v7': ['1-2-3', '2-3-1', '1-3-2', '2-2-2', '3-2-1'],
  '9v9': ['2-3-3', '3-2-3', '2-4-2', '3-3-2'],
  '11v11': ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'],
};

/**
 * Outfield player count per format (for formation validation)
 */
const OUTFIELD_COUNT: Record<string, number> = {
  '5v5': 4,
  '7v7': 6,
  '9v9': 8,
  '11v11': 10,
};

/**
 * Minimum players needed per format
 */
const MIN_PLAYERS: Record<string, number> = {
  '5v5': 5,
  '7v7': 7,
  '9v9': 9,
  '11v11': 11,
};

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'LCB', 'RCB', 'LWB', 'RWB', 'CM', 'LM', 'RM', 'LCM', 'RCM', 'CF'];

interface Season {
  id: string;
  clubId: string;
  format: string;
  matchDurationMinutes: number;
  periods: number;
  maxSquadSize: number;
  formation: string | null;
}

interface Club {
  id: string;
  name: string;
  teamName: string | null;
  ageGroup: string | null;
}

interface AddedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
}

export function SetupWizardPage() {
  const navigate = useNavigate();
  const { activeClubId } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Step 1 state
  const [teamName, setTeamName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [club, setClub] = useState<Club | null>(null);

  // Step 2 state
  const [format, setFormat] = useState('7v7');
  const [season, setSeason] = useState<Season | null>(null);

  // Step 3 state
  const [formation, setFormation] = useState('');
  const [customFormation, setCustomFormation] = useState('');
  const [formationError, setFormationError] = useState('');

  // Step 4 state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [primaryPosition, setPrimaryPosition] = useState('CM');
  const [addedPlayers, setAddedPlayers] = useState<AddedPlayer[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const seasonsRes = await api.get<{ data: (Season & { isActive: boolean })[] }>('/seasons');
        const activeSeason = seasonsRes.data.find(s => s.isActive);
        if (activeSeason) {
          setSeason(activeSeason);
          setFormat(activeSeason.format);
          if (activeSeason.formation) {
            setFormation(activeSeason.formation);
            setCustomFormation(activeSeason.formation);
          }
          // Fetch club data
          if (activeSeason.clubId) {
            try {
              // Use the clubs endpoint - we just need to look at the season's clubId
              setClub({ id: activeSeason.clubId, name: '', teamName: null, ageGroup: null });
              setTeamName('');
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore errors
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Update club from activeClubId
  useEffect(() => {
    if (activeClubId && club && !club.name) {
      // We don't have a GET /clubs/:id endpoint, so we'll just use defaults
      setClub(prev => prev ? { ...prev, id: activeClubId } : { id: activeClubId, name: 'My Club', teamName: null, ageGroup: null });
    }
  }, [activeClubId, club]);

  const handleNext = async () => {
    if (step === 1) {
      // Save club data
      const clubId = club?.id || activeClubId;
      if (clubId && teamName.trim()) {
        try {
          const res = await api.patch<{ data: Club }>(`/clubs/${clubId}`, {
            name: teamName.trim(),
            ageGroup: ageGroup || null,
          });
          setClub(res.data);
        } catch {
          // Continue even if save fails
        }
      }
      setStep(2);
    } else if (step === 2) {
      // Save format to season
      if (season) {
        const defaults = FORMAT_DEFAULTS[format];
        try {
          const res = await api.patch<{ data: Season }>(`/seasons/${season.id}`, {
            format,
            matchDurationMinutes: defaults.matchDurationMinutes,
            periods: defaults.periods,
            maxSquadSize: defaults.maxSquadSize,
          });
          setSeason(res.data);
        } catch {
          // Continue
        }
      }
      setStep(3);
    } else if (step === 3) {
      // Save formation to season
      if (season && formation) {
        try {
          await api.patch(`/seasons/${season.id}`, { formation });
        } catch {
          // Continue
        }
      }
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      // Done — mark complete and go to dashboard
      localStorage.setItem('touchline_setup_complete', 'true');
      navigate('/', { replace: true });
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleAddPlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setAddingPlayer(true);
    try {
      const res = await api.post<{ data: AddedPlayer }>('/players', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        primaryPosition,
      });
      setAddedPlayers(prev => [...prev, res.data]);
      setFirstName('');
      setLastName('');
      setPrimaryPosition('CM');
    } catch {
      // ignore
    } finally {
      setAddingPlayer(false);
    }
  };

  const validateFormation = (f: string): boolean => {
    if (!f) return true;
    const parts = f.split('-').map(Number);
    if (parts.some(n => isNaN(n) || n < 1)) return false;
    const sum = parts.reduce((a, b) => a + b, 0);
    const expected = OUTFIELD_COUNT[format];
    if (expected && sum !== expected) {
      setFormationError(`Numbers must sum to ${expected} (outfield players for ${format})`);
      return false;
    }
    setFormationError('');
    return true;
  };

  const handlePresetClick = (preset: string) => {
    setFormation(preset);
    setCustomFormation(preset);
    setFormationError('');
  };

  const handleCustomFormationChange = (value: string) => {
    setCustomFormation(value);
    if (value && /^[\d]+([-][\d]+)*$/.test(value)) {
      if (validateFormation(value)) {
        setFormation(value);
      }
    } else if (!value) {
      setFormation('');
      setFormationError('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <span className="text-4xl">⚽</span>
          <p className="text-slate-400 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  const minPlayers = MIN_PLAYERS[format] || 7;
  const canProceedStep4 = addedPlayers.length >= minPlayers;

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-900 px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-4xl">⚽</span>
        <h1 className="text-xl font-bold text-white mt-2">Touchline</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s === step
                ? 'bg-emerald-600 text-white'
                : s < step
                ? 'bg-emerald-800 text-emerald-200'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
          {step === 1 && (
            <StepClub
              teamName={teamName}
              setTeamName={setTeamName}
              ageGroup={ageGroup}
              setAgeGroup={setAgeGroup}
            />
          )}
          {step === 2 && (
            <StepFormat
              format={format}
              setFormat={setFormat}
            />
          )}
          {step === 3 && (
            <StepFormation
              format={format}
              formation={formation}
              customFormation={customFormation}
              formationError={formationError}
              onPresetClick={handlePresetClick}
              onCustomChange={handleCustomFormationChange}
            />
          )}
          {step === 4 && (
            <StepPlayers
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              primaryPosition={primaryPosition}
              setPrimaryPosition={setPrimaryPosition}
              addedPlayers={addedPlayers}
              addingPlayer={addingPlayer}
              onAddPlayer={handleAddPlayer}
              minPlayers={minPlayers}
              format={format}
            />
          )}
          {step === 5 && (
            <StepDone
              addedPlayers={addedPlayers}
              format={format}
              formation={formation}
              teamName={teamName}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <div>
            {step > 1 && step < 5 && (
              <button
                onClick={handleBack}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === 4 && !canProceedStep4 && (
              <button
                onClick={() => setStep(5)}
                className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={step === 1 && !teamName.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors text-sm"
            >
              {step === 5 ? 'Go to Dashboard' : step === 4 ? (canProceedStep4 ? 'Next →' : `Need ${minPlayers - addedPlayers.length} more`) : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STEP COMPONENTS
// ============================================================

function StepClub({
  teamName,
  setTeamName,
  ageGroup,
  setAgeGroup,
}: {
  teamName: string;
  setTeamName: (v: string) => void;
  ageGroup: string;
  setAgeGroup: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Your Club</h2>
        <p className="text-sm text-slate-400 mt-1">Let's start with the basics about your team.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="teamName" className="block text-sm font-medium text-slate-300">
          Team Name
        </label>
        <input
          id="teamName"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="e.g. Riverside Rovers"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="ageGroup" className="block text-sm font-medium text-slate-300">
          Age Group
        </label>
        <select
          id="ageGroup"
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">Select age group</option>
          <option value="U7">U7</option>
          <option value="U8">U8</option>
          <option value="U9">U9</option>
          <option value="U10">U10</option>
          <option value="U11">U11</option>
          <option value="U12">U12</option>
          <option value="U13">U13</option>
          <option value="U14">U14</option>
          <option value="U15">U15</option>
          <option value="U16">U16</option>
        </select>
      </div>
    </div>
  );
}

function StepFormat({
  format,
  setFormat,
}: {
  format: string;
  setFormat: (v: string) => void;
}) {
  const formats = ['5v5', '7v7', '9v9', '11v11'];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Match Format</h2>
        <p className="text-sm text-slate-400 mt-1">How many players per side?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {formats.map((f) => {
          const defaults = FORMAT_DEFAULTS[f];
          const isSelected = format === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
              }`}
            >
              <span className={`text-lg font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                {f}
              </span>
              <p className="text-xs text-slate-400 mt-1">
                {defaults.matchDurationMinutes} min · {defaults.periods} periods
              </p>
            </button>
          );
        })}
      </div>

      {format && (
        <div className="bg-slate-700/50 rounded-md p-3 border border-slate-600">
          <p className="text-sm text-slate-300">{FORMAT_DEFAULTS[format].description}</p>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>⏱ {FORMAT_DEFAULTS[format].matchDurationMinutes} minutes</span>
            <span>📋 {FORMAT_DEFAULTS[format].periods} periods</span>
            <span>👥 Max {FORMAT_DEFAULTS[format].maxSquadSize} squad</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepFormation({
  format,
  formation,
  customFormation,
  formationError,
  onPresetClick,
  onCustomChange,
}: {
  format: string;
  formation: string;
  customFormation: string;
  formationError: string;
  onPresetClick: (preset: string) => void;
  onCustomChange: (value: string) => void;
}) {
  const presets = FORMATION_PRESETS[format] || [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Formation</h2>
        <p className="text-sm text-slate-400 mt-1">Pick a starting formation for your {format} team.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onPresetClick(preset)}
            className={`px-4 py-2 text-sm rounded-md border transition-colors font-medium ${
              formation === preset
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-700 text-slate-200 border-slate-600 hover:border-slate-400'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-300">Custom</label>
        <input
          placeholder={`e.g. ${format === '5v5' ? '1-2-1' : '2-3-1'}`}
          value={customFormation}
          onChange={(e) => onCustomChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        {formationError && (
          <p className="text-xs text-red-400">{formationError}</p>
        )}
        <p className="text-xs text-slate-500">
          Numbers represent outfield lines (defence → attack). Must sum to {OUTFIELD_COUNT[format] || '?'}.
        </p>
      </div>

      {formation && (
        <div className="mt-2">
          <PitchPreview formation={formation} />
        </div>
      )}
    </div>
  );
}

function StepPlayers({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  primaryPosition,
  setPrimaryPosition,
  addedPlayers,
  addingPlayer,
  onAddPlayer,
  minPlayers,
  format,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  primaryPosition: string;
  setPrimaryPosition: (v: string) => void;
  addedPlayers: AddedPlayer[];
  addingPlayer: boolean;
  onAddPlayer: (e: FormEvent) => void;
  minPlayers: number;
  format: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Add Your Players</h2>
        <p className="text-sm text-slate-400 mt-1">
          Add at least {minPlayers} players for {format}. You can add more later.
        </p>
      </div>

      <form onSubmit={onAddPlayer} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="position" className="block text-xs font-medium text-slate-400 mb-1">Primary Position</label>
          <select
            id="position"
            value={primaryPosition}
            onChange={(e) => setPrimaryPosition(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          >
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!firstName.trim() || !lastName.trim() || addingPlayer}
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors text-sm"
        >
          {addingPlayer ? 'Adding...' : '+ Add Player'}
        </button>
      </form>

      {/* Added players list */}
      {addedPlayers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">
            Added ({addedPlayers.length}/{minPlayers} minimum)
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {addedPlayers.map((p, i) => (
              <div key={p.id || i} className="flex items-center gap-2 text-sm bg-slate-700/50 rounded px-3 py-1.5">
                <span className="text-slate-200">{p.firstName} {p.lastName}</span>
                <span className="text-xs text-slate-400 ml-auto">{p.primaryPosition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepDone({
  addedPlayers,
  format,
  formation,
  teamName,
}: {
  addedPlayers: AddedPlayer[];
  format: string;
  formation: string;
  teamName: string;
}) {
  return (
    <div className="text-center space-y-4 py-4">
      <span className="text-5xl">🎉</span>
      <h2 className="text-xl font-bold text-white">You're all set!</h2>
      <p className="text-slate-400">
        {teamName ? `${teamName} is` : 'Your team is'} ready to go.
      </p>

      <div className="bg-slate-700/50 rounded-lg p-4 text-left space-y-2 border border-slate-600">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Format</span>
          <span className="text-white font-medium">{format}</span>
        </div>
        {formation && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Formation</span>
            <span className="text-white font-medium">{formation}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Players added</span>
          <span className="text-white font-medium">{addedPlayers.length}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        You can update all of these in Settings at any time.
      </p>
    </div>
  );
}
