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

  const statTiles: { label: string; value: number | string; icon: string }[] = [
    { label: 'Goals', value: s?.goals ?? 0, icon: '⚽' },
    { label: 'Assists', value: s?.assists ?? 0, icon: '🅰️' },
    { label: 'Apps', value: s?.appearances ?? 0, icon: '👕' },
    { label: 'Minutes', value: s?.totalMinutes ?? 0, icon: '⏱️' },
    { label: 'Clean Sheets', value: s?.cleanSheets ?? 0, icon: '🧤' },
    { label: 'MOTM', value: s?.motmAwards ?? 0, icon: '🏆' },
  ];

  const topBadges = [...(badges ?? [])].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 6);
  const positions = s?.positionsPlayed ?? [];
  const form = (data.recentResults ?? []).slice(0, 5);

  const saveImage = () => downloadCardImage(data, trophyPoints, statTiles, topBadges, positions, form, accent, crest);

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
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-black">
              {initials(data.name).toUpperCase()}
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

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            {statTiles.map((t) => (
              <div key={t.label} className="bg-white/15 rounded-lg p-2 text-center backdrop-blur-sm">
                <p className="text-lg font-black leading-none tabular-nums">{t.value}</p>
                <p className="text-[9px] uppercase tracking-wide opacity-80 mt-1">{t.icon} {t.label}</p>
              </div>
            ))}
          </div>

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
async function downloadCardImage(
  data: PlayerCardData,
  trophyPoints: number,
  statTiles: { label: string; value: number | string; icon: string }[],
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

  // Preload the crest (data URL — same origin, safe for canvas export)
  let crestImg: HTMLImageElement | null = null;
  if (crestUrl) {
    crestImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = crestUrl;
    });
  }

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
  ctx.beginPath();
  ctx.arc(pad + 44, avY + 44, 44, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(initials(data.name).toUpperCase(), pad + 44, avY + 22);
  ctx.textAlign = 'left';

  // Name + position
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(data.name, pad + 108, avY + 8);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`${data.position}${data.shirtNumber != null ? `   #${data.shirtNumber}` : ''}`, pad + 108, avY + 52);

  // Stat tiles (3 cols x 2 rows)
  let ty = avY + 120;
  const tileW = (W - pad * 2 - 24) / 3;
  const tileH = 84;
  statTiles.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = pad + col * (tileW + 12);
    const y = ty + row * (tileH + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, x, y, tileW, tileH, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(String(t.value), x + tileW / 2, y + 14);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(t.label.toUpperCase(), x + tileW / 2, y + 54);
    ctx.textAlign = 'left';
  });

  let y = ty + 2 * (tileH + 12) + 24;

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
