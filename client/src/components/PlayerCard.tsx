import { useRef } from 'react';
import { Download } from 'lucide-react';
import { usePlayerBadges } from '@/hooks/use-badges';
import type { PlayerSeasonStats } from '@/services/statistics.service';

/**
 * Shareable "Player Card" — FIFA/Sportradar-flavoured hero card built from
 * achievement data (never a subjective rating). The big headline number is the
 * player's earned Trophy Points. Includes one-tap "Save as image" for parents.
 */

export interface PlayerCardData {
  playerId: string;
  name: string;
  shirtNumber: number | null;
  position: string;
  clubName: string;
  stats: PlayerSeasonStats | null;
  recentResults?: { result: string | null }[]; // most-recent first
  crestUrl?: string | null;      // club crest (data URL) if set
  primaryColor?: string | null;  // club primary colour (hex) if set
  photoUrl?: string | null;      // player photo (data URL) if set
}

const TIER_MEDAL: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };

// Deterministic colour from a name so each player has a consistent accent
function accentFor(name: string): { from: string; to: string; solid: string } {
  const palettes = [
    { from: '#1e3a8a', to: '#3b82f6', solid: '#2563eb' }, // blue
    { from: '#065f46', to: '#10b981', solid: '#059669' }, // green
    { from: '#7c2d12', to: '#f59e0b', solid: '#d97706' }, // amber
    { from: '#581c87', to: '#a855f7', solid: '#9333ea' }, // purple
    { from: '#831843', to: '#ec4899', solid: '#db2777' }, // pink
    { from: '#164e63', to: '#06b6d4', solid: '#0891b2' }, // cyan
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

/** Darken (negative) or lighten (positive) a hex colour by a factor. */
function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + (factor < 0 ? c * factor : (255 - c) * factor))));
  r = adj(r); g = adj(g); b = adj(b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** A small progress ring (SVG) for the analytical card visuals. */
function Ring({ label, sub, pct, caption }: { label: string; sub: string; pct: number; caption: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="bg-white/12 rounded-lg p-2 flex items-center gap-2.5 backdrop-blur-sm">
      <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 30 30)"
        />
        <text x="30" y="34" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{sub}</text>
      </svg>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide leading-tight">{label}</p>
        <p className="text-[9px] opacity-75 leading-tight">{caption}</p>
      </div>
    </div>
  );
}

export function PlayerCard({ data }: { data: PlayerCardData }) {
  const { data: badges } = usePlayerBadges(data.playerId);
  const cardRef = useRef<HTMLDivElement>(null);

  const trophyPoints = (badges ?? []).reduce((s, b) => s + (b.points ?? 0), 0);
  // Prefer the club's brand colour; otherwise a per-player auto colour.
  const accent = data.primaryColor
    ? { from: shade(data.primaryColor, -0.25), to: data.primaryColor, solid: data.primaryColor }
    : accentFor(data.name);
  const crest = data.crestUrl || null;
  const s = data.stats;

  // ── Analytical derivations ────────────────────────────────
  const goals = s?.goals ?? 0;
  const assists = s?.assists ?? 0;
  const involvements = s?.goalInvolvements ?? goals + assists;
  const apps = s?.appearances ?? 0;
  const totalMins = s?.totalMinutes ?? 0;
  const cleanSheets = s?.cleanSheets ?? 0;
  const periodsPlayed = s?.periodsPlayed ?? 0;

  // Ring 1: progress toward the next goal-involvement milestone (5/10/15/20)
  const goalMilestones = [5, 10, 15, 20, 30, 40];
  const nextGoalTarget = goalMilestones.find((m) => m > goals) ?? (goals + 5);
  const prevGoalBase = goalMilestones.filter((m) => m <= goals).pop() ?? 0;
  const goalRingPct = nextGoalTarget > prevGoalBase
    ? Math.min(100, Math.round(((goals - prevGoalBase) / (nextGoalTarget - prevGoalBase)) * 100))
    : 0;

  // Ring 2: clean-sheet rate — clean-sheet periods as a share of periods played
  const csRatePct = periodsPlayed > 0 ? Math.min(100, Math.round((cleanSheets / periodsPlayed) * 100)) : 0;

  // Contribution split (goals vs assists)
  const goalPct = involvements > 0 ? Math.round((goals / involvements) * 100) : 0;

  // Pundit-style insight lines (only include ones that are meaningful)
  const insights: string[] = [];
  if (goals > 0 && s?.minutesPerGoal) insights.push(`⚽ A goal every ${s.minutesPerGoal} mins on the pitch`);
  if (involvements > 0) insights.push(`🎯 ${involvements} goal involvement${involvements === 1 ? '' : 's'} (${goals}G, ${assists}A)`);
  if ((s?.positionVariety ?? 0) >= 2) insights.push(`🔄 Played ${s!.positionVariety} different positions`);
  if (cleanSheets > 0) insights.push(`🧤 Clean sheet in ${cleanSheets} ${cleanSheets === 1 ? 'period' : 'periods'}`);
  if (apps > 0) insights.push(`⏱️ Averages ${s?.avgMinutesPerAppearance ?? Math.round(totalMins / apps)} mins per game`);
  if ((s?.motmAwards ?? 0) > 0) insights.push(`🏆 Player of the Match ${s!.motmAwards}×`);
  const topInsights = insights.slice(0, 3);

  // Compact "by the numbers" footer figures
  const numbers: { label: string; value: number | string }[] = [
    { label: 'Apps', value: apps },
    { label: 'Goals', value: goals },
    { label: 'Assists', value: assists },
    { label: 'Mins', value: totalMins },
    { label: 'CS', value: cleanSheets },
    { label: 'POTM', value: s?.motmAwards ?? 0 },
  ];

  const topBadges = [...(badges ?? [])].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 6);
  const positions = s?.positionsPlayed ?? [];
  const form = (data.recentResults ?? []).slice(0, 5);

  const saveImage = () => downloadCardImage(
    data, trophyPoints,
    { goals, assists, involvements, goalPct, goalRingPct, nextGoalTarget, csRatePct, insights: topInsights, numbers },
    topBadges, positions, form, accent, crest,
  );

  return (
    <div className="space-y-3">
      {/* The card */}
      <div
        ref={cardRef}
        className="relative rounded-2xl overflow-hidden text-white shadow-xl mx-auto max-w-sm"
        style={{ background: `linear-gradient(160deg, ${accent.from} 0%, ${accent.to} 100%)` }}
      >
        {/* subtle pitch texture */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(255,255,255,0.4) 22px, rgba(255,255,255,0.4) 23px)' }} />

        {/* Faint crest watermark behind the content */}
        {crest && (
          <img
            src={crest}
            alt=""
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-[0.08] pointer-events-none"
          />
        )}

        <div className="relative p-5 space-y-4">
          {/* Header: crest + club + trophy points */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {crest && (
                <div className="w-10 h-10 rounded-md bg-white/90 p-0.5 flex items-center justify-center shrink-0">
                  <img src={crest} alt="Club crest" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest opacity-90 truncate">{data.clubName}</p>
                <p className="text-[10px] opacity-70">Season Card</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black leading-none tabular-nums">{trophyPoints}</p>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Trophy Pts</p>
            </div>
          </div>

          {/* Hero: avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-black overflow-hidden shrink-0">
              {data.photoUrl ? (
                <img src={data.photoUrl} alt={data.name} className="w-full h-full object-cover" />
              ) : (
                initials(data.name).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black leading-tight truncate">{data.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold bg-white/25 rounded px-1.5 py-0.5">{data.position}</span>
                {data.shirtNumber != null && (
                  <span className="text-[11px] font-bold bg-white/25 rounded px-1.5 py-0.5">#{data.shirtNumber}</span>
                )}
              </div>
            </div>
          </div>

          {/* Analytical: headline rings */}
          <div className="grid grid-cols-2 gap-2">
            <Ring label="Goals" sub={`${goals} / ${nextGoalTarget}`} pct={goalRingPct} caption="to next milestone" />
            <Ring label="Clean sheets" sub={`${csRatePct}%`} pct={csRatePct} caption="of periods played" />
          </div>

          {/* Contribution split: goals vs assists */}
          {involvements > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest opacity-80 mb-1">
                <span>Attacking contribution</span>
                <span>{involvements} G+A</span>
              </div>
              <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/20">
                <div className="h-full bg-white" style={{ width: `${goalPct}%` }} />
                <div className="h-full bg-white/50" style={{ width: `${100 - goalPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px] opacity-80 mt-1">
                <span>⚽ {goals} goals</span>
                <span>🅰️ {assists} assists</span>
              </div>
            </div>
          )}

          {/* Pundit-style insights */}
          {topInsights.length > 0 && (
            <div className="space-y-1">
              {topInsights.map((line, i) => (
                <div key={i} className="text-[11px] bg-white/12 rounded-md px-2.5 py-1.5 leading-snug">{line}</div>
              ))}
            </div>
          )}

          {/* Positions played */}
          {positions.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Positions played</p>
              <div className="flex flex-wrap gap-1">
                {positions.map((p) => (
                  <span key={p} className="text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Trophy cabinet */}
          {topBadges.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Trophy cabinet</p>
              <div className="flex flex-wrap gap-1.5">
                {topBadges.map((b) => (
                  <span key={b.id} className="text-[10px] font-medium bg-white/15 rounded-full px-2 py-1 flex items-center gap-1">
                    <span>{TIER_MEDAL[b.tier] ?? '⭐'}</span>{b.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Form strip */}
          {form.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest opacity-80">Form</span>
              {form.map((r, i) => {
                const res = r.result === 'win' ? 'W' : r.result === 'loss' ? 'L' : 'D';
                const bg = r.result === 'win' ? 'bg-emerald-400 text-emerald-900' : r.result === 'loss' ? 'bg-red-400 text-red-900' : 'bg-white/40 text-white';
                return <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${bg}`}>{res}</span>;
              })}
            </div>
          )}

          {/* By the numbers */}
          <div className="border-t border-white/20 pt-2">
            <div className="grid grid-cols-6 gap-1 text-center">
              {numbers.map((n) => (
                <div key={n.label}>
                  <p className="text-sm font-black leading-none tabular-nums">{n.value}</p>
                  <p className="text-[8px] uppercase tracking-wide opacity-70 mt-0.5">{n.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer branding */}
          <div className="pt-1 flex items-center justify-between text-[9px] opacity-70">
            <span className="font-bold tracking-widest">⚽ TOUCHLINE</span>
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Save as image */}
      <div className="max-w-sm mx-auto">
        <button
          onClick={saveImage}
          className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Download className="h-4 w-4" /> Save card as image
        </button>
      </div>
    </div>
  );
}

/**
 * Render the card to a canvas and trigger a PNG download. Dependency-free so
 * we don't add an html-to-image library.
 */
interface CardAnalytics {
  goals: number;
  assists: number;
  involvements: number;
  goalPct: number;
  goalRingPct: number;
  nextGoalTarget: number;
  csRatePct: number;
  insights: string[];
  numbers: { label: string; value: number | string }[];
}

async function downloadCardImage(
  data: PlayerCardData,
  trophyPoints: number,
  a: CardAnalytics,
  badges: { title: string; tier: string }[],
  positions: string[],
  form: { result: string | null }[],
  accent: { from: string; to: string; solid: string },
  crestUrl: string | null,
) {
  const W = 620, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Preload images (data URLs — same origin, safe for canvas export)
  const loadImg = (src: string | null) => src
    ? new Promise<HTMLImageElement | null>((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; })
    : Promise.resolve(null);
  const crestImg = await loadImg(crestUrl);
  const photoImg = await loadImg(data.photoUrl ?? null);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, accent.from);
  grad.addColorStop(1, accent.to);
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 32); ctx.fill();

  // Faint crest watermark
  if (crestImg) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    const size = 380;
    ctx.drawImage(crestImg, (W - size) / 2, (H - size) / 2, size, size);
    ctx.restore();
  }

  const pad = 44;
  ctx.textBaseline = 'top';

  // Small crest logo in the header (on a white rounded panel)
  if (crestImg) {
    const cs = 56;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, pad, pad - 6, cs, cs, 10); ctx.fill();
    ctx.drawImage(crestImg, pad + 4, pad - 2, cs - 8, cs - 8);
  }
  const clubTextX = crestImg ? pad + 68 : pad;

  // Club + trophy points
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(data.clubName.toUpperCase(), clubTextX, pad);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('SEASON CARD', clubTextX, pad + 24);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(String(trophyPoints), W - pad, pad - 6);
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('TROPHY PTS', W - pad, pad + 62);
  ctx.textAlign = 'left';

  // Avatar circle
  const avY = pad + 110;
  const acx = pad + 44, acy = avY + 44, ar = 44;
  if (photoImg) {
    ctx.save();
    ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    // cover-fit the (square) photo into the circle's bounding box
    ctx.drawImage(photoImg, acx - ar, acy - ar, ar * 2, ar * 2);
    ctx.restore();
    ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(acx, acy, ar, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(initials(data.name).toUpperCase(), acx, avY + 22);
    ctx.textAlign = 'left';
  }

  // Name + position
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(data.name, pad + 108, avY + 8);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`${data.position}${data.shirtNumber != null ? `   #${data.shirtNumber}` : ''}`, pad + 108, avY + 52);

  // ── Analytical: two headline rings ──
  let y = avY + 120;
  const ringPanelW = (W - pad * 2 - 16) / 2;
  const ringPanelH = 96;
  const drawRingPanel = (px: number, pct: number, centre: string, label: string, caption: string) => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, px, y, ringPanelW, ringPanelH, 12); ctx.fill();
    // Ring
    const cxr = px + 48, cyr = y + ringPanelH / 2, rr = 32;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(cxr, cyr, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cxr, cyr, rr, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, Math.min(100, pct)) / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(centre, cxr, cyr);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    // Label
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(label, px + 92, y + 30);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(caption, px + 92, y + 50);
  };
  drawRingPanel(pad, a.goalRingPct, `${a.goals}/${a.nextGoalTarget}`, 'Goals', 'to next milestone');
  drawRingPanel(pad + ringPanelW + 16, a.csRatePct, `${a.csRatePct}%`, 'Clean sheets', 'of periods');
  y += ringPanelH + 20;

  // ── Contribution split bar ──
  if (a.involvements > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('ATTACKING CONTRIBUTION', pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${a.involvements} G+A`, W - pad, y);
    ctx.textAlign = 'left';
    y += 20;
    const barW = W - pad * 2;
    const gW = Math.round((a.goalPct / 100) * barW);
    ctx.fillStyle = '#fff';
    roundRect(ctx, pad, y, gW, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, pad + gW, y, barW - gW, 12, 6); ctx.fill();
    y += 20;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`⚽ ${a.goals} goals`, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`🅰 ${a.assists} assists`, W - pad, y);
    ctx.textAlign = 'left';
    y += 30;
  }

  // ── Insight lines ──
  for (const line of a.insights) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, pad, y, W - pad * 2, 32, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(line, pad + 12, y + 9);
    y += 40;
  }
  y += 4;

  // Positions
  if (positions.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('POSITIONS PLAYED', pad, y);
    y += 24;
    ctx.font = 'bold 14px system-ui, sans-serif';
    let cx = pad;
    for (const p of positions) {
      const w = ctx.measureText(p).width + 20;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, cx, y, w, 26, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(p, cx + 10, y + 5);
      cx += w + 8;
    }
    y += 44;
  }

  // Trophy cabinet
  if (badges.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('TROPHY CABINET', pad, y);
    y += 24;
    ctx.font = '13px system-ui, sans-serif';
    const medal: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
    let cx = pad;
    for (const b of badges) {
      const label = `${medal[b.tier] ?? '⭐'} ${b.title}`;
      const w = ctx.measureText(label).width + 20;
      if (cx + w > W - pad) { cx = pad; y += 34; }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, cx, y, w, 28, 14); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx + 10, y + 7);
      cx += w + 8;
    }
    y += 48;
  }

  // By the numbers (fixed near the bottom)
  const numY = H - pad - 70;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, numY - 12); ctx.lineTo(W - pad, numY - 12); ctx.stroke();
  const colW = (W - pad * 2) / a.numbers.length;
  a.numbers.forEach((n, i) => {
    const cx = pad + colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(String(n.value), cx, numY);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(n.label.toUpperCase(), cx, numY + 26);
  });
  ctx.textAlign = 'left';

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('⚽ TOUCHLINE', pad, H - pad);
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), W - pad, H - pad);
  ctx.textAlign = 'left';

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, '-').toLowerCase()}-card.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
