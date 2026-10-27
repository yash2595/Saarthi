export type Destination = { path: string; label: string };
export type NavigationReply = {
  kind: 'navigate' | 'clarify' | 'cancel' | 'back' | 'help' | 'unknown';
  text: string;
  destination?: Destination;
  choices?: Destination[];
};

const destinations = {
  home: { path: '/', label: 'Home' },
  puja: { path: '/puja', label: 'Puja services' },
  kundali: { path: '/kundali-creation', label: 'Kundali' },
  muhurat: { path: '/muhurat-finder', label: 'Muhurat Finder' },
  pandit: { path: '/sign-up?role=pandit', label: 'Pandit registration' },
  signup: { path: '/sign-up', label: 'Devotee registration' },
  login: { path: '/login', label: 'Login' },
  panditLogin: { path: '/login?role=pandit', label: 'Pandit login' },
  dashboard: { path: '/dashboard', label: 'My account' },
  contact: { path: '/#contact', label: 'Contact' },
  about: { path: '/#mission', label: 'About MantraSetu' },
} satisfies Record<string, Destination>;

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

const matches = (text: string, pattern: string) => new RegExp(`(?:^|[^a-z])(?:${pattern})(?=$|[^a-z])`, 'iu').test(text);
const go = (destination: Destination): NavigationReply => ({ kind: 'navigate', destination, text: `${destination.label} khol diya. Aap agla page bhi bata sakte hain.` });

/** Navigation only: never submits forms, invents a booking, or sends messages to an AI provider. */
export function resolveNavigationMessage(message: string, pending: Destination[] = []): NavigationReply {
  const text = message.normalize('NFKC').toLowerCase().replace(/[’]/g, "'").trim().slice(0, 500);
  if (!text) return { kind: 'unknown', text: 'Kaunsa page kholna hai? Jaise: “Puja dikhao” ya “Kundali banao”.' };
  if (matches(text, "cancel|stop|rehne do|chhodo|nahi|nahin|nhi|mat|don't|do not|no|नहीं|नही|मत|रहने दो")) {
    return { kind: 'cancel', text: 'Theek hai, page nahi badla. Aap doosra page bata sakte hain.' };
  }
  if (matches(text, 'wapas|wapis|back|pichla|pichhle|पिछला|वापस')) return { kind: 'back', text: 'Pichhla page khol diya.' };
  if (matches(text, 'help|madad|options|kya kar sakte|मदद')) return {
    kind: 'help', text: 'Main pages khol sakta hoon. Puja, Kundali, Muhurat, Login ya Pandit registration bataiye. Form submit aur booking confirm aap khud karenge.',
    choices: [destinations.puja, destinations.kundali, destinations.muhurat, destinations.pandit, destinations.login],
  };
  if (pending.length === 1 && /^(?:haan|han|ha|yes|ok|okay|theek|वही|हाँ|हां|ठीक)(?:[\s,]+(?:khol do|open it|please|खोल दो))?[.!\s]*$/u.test(text)) return go(pending[0]);
  if (pending.length > 1 && /^(?:pehla|first|1|पहला)[.!\s]*$/u.test(text)) return go(pending[0]);
  if (pending.length > 1 && /^(?:dusra|doosra|second|2|दूसरा)[.!\s]*$/u.test(text)) return go(pending[1]);

  const found: Destination[] = [];
  const add = (item: Destination) => { if (!found.some(d => d.path === item.path)) found.push(item); };
  const pandit = matches(text, 'pandit|panditji|priest|पंडित|पण्डित');
  const login = matches(text, 'login|log in|sign in|signin|लॉगिन');
  const signup = matches(text, 'signup|sign up|register|registration|join|banna|ban na|रजिस्ट्रेशन|पंजीकरण|जुड़ना|बनना');
  if (login) add(pandit ? destinations.panditLogin : destinations.login);
  if (signup) add(pandit ? destinations.pandit : destinations.signup);
  if (matches(text, 'kundali|kundli|janam patri|birth chart|कुंडली|कुण्डली|जन्मपत्री')) add(destinations.kundali);
  if (matches(text, 'muhurat|muhurth|muhurt|shubh samay|auspicious|मुहूर्त|मुहुरत|शुभ समय')) add(destinations.muhurat);
  if (matches(text, 'puja|pooja|havan|katha|पूजा|हवन|कथा') || (pandit && matches(text, 'book|bulao|booking|बुक|बुलाओ'))) add(destinations.puja);
  const services: Array<[string, string]> = [
    ['ganesh|ganesha|गणेश', 'Ganesh Puja'], ['satyanarayan|सत्यनारायण', 'Satyanarayan'],
    ['griha pravesh|grih pravesh|housewarming|गृह प्रवेश', 'Griha Pravesh'],
    ['rudra|rudrabhishek|रुद्र|रुद्राभिषेक', 'Rudra Abhishek'],
  ];
  if (!found.some(d => d.path === destinations.muhurat.path)) {
    for (const [pattern, service] of services) {
      if (matches(text, pattern)) {
        const index = found.findIndex(d => d.path === '/puja');
        if (index >= 0) found.splice(index, 1);
        add({ path: `/puja?q=${encodeURIComponent(service)}`, label: service });
      }
    }
  }
  if (matches(text, 'home|homepage|main page|ghar wala page|होम|मुख्य पृष्ठ')) add(destinations.home);
  if (matches(text, 'dashboard|profile|my account|mera account|meri profile|प्रोफाइल|मेरा अकाउंट')) add(destinations.dashboard);
  if (matches(text, 'contact|sampark|support|संपर्क')) add(destinations.contact);
  if (matches(text, 'about|hamare bare|mantrasetu ke bare|परिचय')) add(destinations.about);
  if (pandit && !found.length) return { kind: 'clarify', text: 'Panditji book karne hain, registration karna hai, ya pandit login kholna hai?', choices: [destinations.puja, destinations.pandit, destinations.panditLogin] };
  if (found.length > 1) return { kind: 'clarify', text: 'Ek se zyada pages mile. Pehle kaunsa kholun?', choices: found };
  if (found.length === 1) {
    if (matches(text, 'kya hai|what is|meaning|matlab|क्या है|मतलब')) return { kind: 'clarify', text: `Main yahan page navigation mein madad kar sakta hoon. ${found[0].label} page kholun? “Haan” ya “nahi” bataiye.`, choices: found };
    return go(found[0]);
  }
  if (pending.length && matches(text, 'haan|yes|वही|हाँ|हां')) return { kind: 'clarify', text: 'Kaunsa option? Uska naam, “pehla” ya “dusra” bataiye.', choices: pending };
  return { kind: 'unknown', text: 'Page samajh nahi aaya. “Kundali banao”, “Puja dikhao”, “Muhurat khol do” ya “madad” likhiye.' };
}
