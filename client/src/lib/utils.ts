import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx for conditional class names.
 * Used throughout the UI component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a match scoreline in natural HOME – AWAY order.
 *
 * Internally results store goalsFor (our goals) and goalsAgainst (opponent).
 * Football scores are conventionally read home-first, so for away fixtures we
 * swap the display order. The result (win/draw/loss) is unaffected.
 *
 * @param goalsFor our team's goals
 * @param goalsAgainst opponent's goals
 * @param homeAway 'home' | 'away' | null
 * @returns e.g. "3 – 5" (home – away)
 */
export function formatScoreline(
  goalsFor: number | string,
  goalsAgainst: number | string,
  homeAway?: string | null
): string {
  const gf = goalsFor ?? '?';
  const ga = goalsAgainst ?? '?';
  if (homeAway === 'away') {
    // We're away: opponent is home, so their goals come first
    return `${ga} – ${gf}`;
  }
  // Home (or unknown): our goals first
  return `${gf} – ${ga}`;
}
