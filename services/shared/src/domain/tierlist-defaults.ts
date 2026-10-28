import { keysBetween } from './fractional-index';

/** Categories created with every new tierlist, top to bottom. */
const DEFAULT_CATEGORY_STYLES = [
  { name: 'S', color: '#ef4444' },
  { name: 'A', color: '#f97316' },
  { name: 'B', color: '#eab308' },
  { name: 'C', color: '#22c55e' },
  { name: 'D', color: '#3b82f6' },
] as const;

export function defaultCategories(): { name: string; color: string; position: string }[] {
  const positions = keysBetween(null, null, DEFAULT_CATEGORY_STYLES.length);
  return DEFAULT_CATEGORY_STYLES.map((style, i) => ({ ...style, position: positions[i]! }));
}
