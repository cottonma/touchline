import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx for conditional class names.
 * Used throughout the UI component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
