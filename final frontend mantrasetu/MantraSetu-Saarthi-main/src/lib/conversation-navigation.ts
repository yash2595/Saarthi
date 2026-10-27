/** A welcome phrase can accompany navigation; never erase its action. */
export function isGreetingOnlyResponse(action: unknown, intent: unknown, text: string): boolean {
  return !action && (intent === 'GREETING' || /namaste|om namah shivaya/i.test(text));
}
/** Accept only real, same-site routes, including aliases emitted by the AI service. */
export function normalizeNavigationTarget(target: unknown): string | null {
  if (typeof target !== 'string') return null;
  const value = target.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  const url = new URL(value, 'https://saarthi.local');
  const aliases: Record<string, string> = {
    '/services': '/puja', '/kundali': '/kundali-creation', '/muhurat': '/muhurat-finder',
    '/signup': '/sign-up', '/profile': '/dashboard', '/contact': '/', '/about': '/',
  };
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const path = aliases[pathname] || pathname;
  if (!['/', '/puja', '/kundali-creation', '/muhurat-finder', '/sign-up', '/login', '/dashboard'].includes(path)) return null;
  const params = new URLSearchParams();
  if ((path === '/sign-up' || path === '/login') && url.searchParams.get('role') === 'pandit') params.set('role', 'pandit');
  if (path === '/puja') {
    for (const key of ['q', 'service', 'city']) {
      const item = url.searchParams.get(key)?.trim().slice(0, 100);
      if (item) params.set(key, item);
    }
  }
  const hash = pathname === '/contact' ? '#contact' : pathname === '/about' ? '#mission'
    : path === '/' && ['#home', '#journey', '#services', '#mission', '#contact'].includes(url.hash) ? url.hash : '';
  return path + (params.size ? `?${params}` : '') + hash;
}

export function isPanditNavigation(intent: unknown, target: unknown, activeField?: unknown): boolean {
  const normalized = normalizeNavigationTarget(target);
  return intent === 'PANDIT_ONBOARDING'
    || !!normalized?.startsWith('/sign-up?role=pandit')
    || (typeof activeField === 'string' && activeField.startsWith('pandit-'));
}

export function uniqueServiceForBooking<T extends { title: string }>(services: T[], query: string): T | undefined {
  const words: string[] = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) return undefined;
  const candidates = services.filter(service => {
    const titleWords: string[] = service.title.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    return words.every(word => titleWords.includes(word));
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
