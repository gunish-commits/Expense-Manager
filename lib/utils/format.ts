// lib/utils/format.ts

/**
 * Formats a numeric amount to Indian Rupee (INR) currency display format.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Formats a standard ISO date string (YYYY-MM-DD) into a human-readable string.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Returns a fitting Emoji category icon for a given category name.
 */
export function getCategoryEmoji(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('dinner') || cat.includes('restaurant') || cat.includes('meal')) return '🍔';
  if (cat.includes('rent') || cat.includes('house') || cat.includes('accommodation') || cat.includes('stay') || cat.includes('lodging')) return '🏠';
  if (cat.includes('travel') || cat.includes('transport') || cat.includes('flight') || cat.includes('cab') || cat.includes('taxi') || cat.includes('uber')) return '✈️';
  if (cat.includes('movie') || cat.includes('show') || cat.includes('entertainment') || cat.includes('ticket') || cat.includes('game')) return '🎬';
  if (cat.includes('utility') || cat.includes('wifi') || cat.includes('electricity') || cat.includes('water') || cat.includes('internet')) return '🔌';
  if (cat.includes('groceries') || cat.includes('shop') || cat.includes('market')) return '🛒';
  return '💸';
}

/**
 * Returns Tailwind color classes (background and text) for badges based on the category.
 */
export function getCategoryColor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('dinner')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (cat.includes('rent') || cat.includes('house') || cat.includes('lodging')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (cat.includes('travel') || cat.includes('transport')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
  if (cat.includes('movie') || cat.includes('entertainment')) return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
  if (cat.includes('utility') || cat.includes('wifi')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (cat.includes('groceries') || cat.includes('shop')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
}
