export type NavigationEntry = { key: string; path: string };
export type NavigationHistory = { entries: NavigationEntry[]; index: number };

/** Mirror React Router entries so in-app Back follows browser Back and auth redirects. */
export function recordNavigation(history: NavigationHistory, entry: NavigationEntry, action: 'POP' | 'PUSH' | 'REPLACE'): NavigationHistory {
  const known = history.entries.findIndex(item => item.key === entry.key);
  if (known >= 0) return { ...history, index: known };
  if (action === 'POP') return { entries: [entry], index: 0 };
  if (action === 'REPLACE') {
    const entries = [...history.entries];
    entries[history.index] = entry;
    return { entries, index: history.index };
  }
  const entries = [...history.entries.slice(0, history.index + 1), entry].slice(-30);
  return { entries, index: entries.length - 1 };
}

export function canGoBack(history: NavigationHistory): boolean { return history.index > 0; }
