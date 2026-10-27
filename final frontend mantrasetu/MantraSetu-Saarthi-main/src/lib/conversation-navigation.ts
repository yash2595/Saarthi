export type Destination = { path: string; label: string };
export type NavigationReply = {
  kind: 'navigate' | 'clarify' | 'cancel' | 'back' | 'help' | 'unknown' | 'unavailable';
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

const indexOf = (text: string, pattern: string) => {
  const match = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{M}\\p{N}])`, 'iu').exec(text);
  return match ? match.index + match[1].length : -1;
};
const matches = (text: string, pattern: string) => indexOf(text, pattern) >= 0;
const negativePattern = "cancel|stop|rehne do|chhodo|nahi|nahin|nhi|mat|don't|do not|no|नहीं|नही|मत|रहने दो";
const actionPattern = 'open|show|go to|take me|find|book|booking|register|registration|signup|sign up|sign in|login|log in|join|banna|kholo|khol|kholna|kholen|dikhao|dikha|dikhana|banao|bana do|banwani|banani|karni|karwani|le chalo|chahiye|खोलो|खोल|दिखाओ|दिखा|बनाओ|बनवानी|करवानी|करनी|बुक|पंजीकरण|चाहिए';
const phrases = {
  pandit: 'pandit|panditji|pandit ji|priest|पंडित|पंडितजी|पंडित जी|पण्डित',
  login: 'login|log in|sign in|signin|लॉगिन',
  signup: 'signup|sign up|register|registration|join|banna|ban na|रजिस्ट्रेशन|पंजीकरण|जुड़ना|बनना',
  kundali: 'kundali|kundli|janam patri|birth chart|कुंडली|कुण्डली|जन्मपत्री',
  muhurat: 'muhurat|muhurth|muhurt|shubh samay|auspicious|मुहूर्त|मुहुरत|शुभ समय',
  puja: 'puja|pooja|havan|katha|पूजा|हवन|कथा',
  home: 'home|homepage|main page|ghar wala page|होम|मुख्य पृष्ठ',
  dashboard: 'dashboard|profile|my account|mera account|meri profile|प्रोफाइल|मेरा अकाउंट',
  contact: 'contact|sampark|support|संपर्क',
  about: 'about us|about|hamare bare|mantrasetu ke bare|परिचय',
};
const services: Array<[string, string]> = [
  ['ganesh|ganesha|गणेश', 'Ganesh Puja'], ['satyanarayan|सत्यनारायण', 'Satyanarayan'],
  ['griha pravesh|grih pravesh|housewarming|गृह प्रवेश', 'Griha Pravesh'],
  ['rudra|rudrabhishek|रुद्र|रुद्राभिषेक', 'Rudra Abhishek'],
  ['laxmi|lakshmi|kuber|लक्ष्मी|कुबेर', 'Laxmi Kuber'],
  ['navgraha|navagraha|नवग्रह', 'Navgraha Shanti'],
  ['mrityunjaya|mrityunjay|मृत्युंजय', 'Maha Mrityunjaya'],
  ['kalsarp|kaalsarp|कालसर्प', 'Kalsarp Dosha'],
];
const go = (destination: Destination): NavigationReply => ({ kind: 'navigate', destination, text: `${destination.label} khol diya. Aap agla page bhi bata sakte hain.` });
const unknown = (): NavigationReply => ({ kind: 'unknown', text: 'Main page navigation mein madad kar sakta hoon. “Kundali banao”, “Puja dikhao”, “Muhurat khol do” ya “madad” likhiye.' });

/** Navigation only: never submits forms, invents a booking, or sends messages to an AI provider. */
export function resolveNavigationMessage(message: string, pending: Destination[] = []): NavigationReply {
  let text = message.normalize('NFKC').toLowerCase().replace(/[’]/g, "'").trim().slice(0, 500);
  if (!text) return { kind: 'unknown', text: 'Kaunsa page kholna hai? Jaise: “Puja dikhao” ya “Kundali banao”.' };
  if (/(?:https?:\/\/|[^\s@]+@[^\s@]+\.[^\s@]+)/iu.test(text)) return unknown();
  if (matches(text, negativePattern)) {
    const positive = text.split(/[,;.!?।]|\b(?:but|instead|lekin|balki)\b|लेकिन|बल्कि/iu)
      .map(clause => clause.trim()).filter(clause => clause && !matches(clause, negativePattern));
    if (!positive.length) {
      const tail = text.split(/(?:^|\s)(?:nahi|nahin|nhi|नहीं|नही)(?:\s|$)/u).at(-1) || '';
      if (tail !== text && !matches(tail, negativePattern) && matches(tail, actionPattern)
        && matches(tail, [...Object.values(phrases), ...services.map(item => item[0])].join('|'))) positive.push(tail);
    }
    if (!positive.length) return { kind: 'cancel', text: 'Theek hai, page nahi badla. Aap doosra page bata sakte hain.' };
    text = positive.join(', ');
  }
  if (matches(text, 'wapas|wapis|back|pichla|pichhle|पिछला|वापस')) {
    if (matches(text, phrases.home)) return go(destinations.home);
    if (!matches(text, Object.values(phrases).join('|'))) return { kind: 'back', text: 'Pichhla page khol diya.' };
  }
  if (matches(text, 'help|madad|options|kya kar sakte|मदद')) return {
    kind: 'help', text: 'Main pages khol sakta hoon. Puja, Kundali, Muhurat, Login ya Pandit registration bataiye. Form submit aur booking confirm aap khud karenge.',
    choices: [destinations.puja, destinations.kundali, destinations.muhurat, destinations.pandit, destinations.login],
  };
  if (pending.length && /^(?:haan|han|ha|yes|ok|okay|theek|वही|हाँ|हां|ठीक)(?:[\s,]+(?:khol do|open it|please|खोल दो))?[.!\s]*$/u.test(text)) return pending.length === 1 ? go(pending[0]) : { kind: 'clarify', text: 'Kaunsa option? Uska naam ya number bataiye.', choices: pending };
  if (pending.length) {
    const ordinal = /^(?:(?:option|number|नंबर|विकल्प)\s*)?(pehla|first|पहला|dusra|doosra|second|दूसरा|teesra|tisra|third|तीसरा|chautha|fourth|चौथा|paanchva|panchva|fifth|पांचवा|last|aakhri|akhri|आखिरी|अंतिम|[1-9१-९])(?:\s+(?:wala|wali|option|page|kholo|khol do|open|please|खोलो|खोल दो|वाला|वाली))*[.!।\s]*$/u.exec(text);
    if (ordinal) {
      const positions: Record<string, number> = { pehla: 0, first: 0, 'पहला': 0, dusra: 1, doosra: 1, second: 1, 'दूसरा': 1, teesra: 2, tisra: 2, third: 2, 'तीसरा': 2, chautha: 3, fourth: 3, 'चौथा': 3, paanchva: 4, panchva: 4, fifth: 4, 'पांचवा': 4 };
      const value = ordinal[1];
      const index = positions[value] ?? (/[1-9]/u.test(value) ? Number(value) - 1 : /[१-९]/u.test(value) ? value.charCodeAt(0) - '१'.charCodeAt(0) : pending.length - 1);
      return pending[index] ? go(pending[index]) : { kind: 'clarify', text: 'Yeh option list mein nahi hai. Dikh rahe options mein se naam ya number bataiye.', choices: pending };
    }
  }

  if (matches(text, 'rashifal|horoscope|gemstone|panchang|choghadiya|राशिफल|रत्न|पंचांग|चौघड़िया')) return { kind: 'unavailable', text: 'Yeh tool abhi available nahi hai. Puja, Kundali aur Muhurat ke pages khol sakta hoon.', choices: [destinations.puja, destinations.kundali, destinations.muhurat] };

  if (/^(?:my (?:name|email|phone|date of birth)|mera (?:naam|email|phone)|meri (?:date|janam)|मेरा नाम|मेरा ईमेल)/iu.test(text)) return unknown();

  const found: Destination[] = [];
  const order = new Map<string, number>();
  const add = (item: Destination, pattern: string) => {
    const position = indexOf(text, pattern);
    if (position < 0) return;
    if (!found.some(d => d.path === item.path)) { found.push(item); order.set(item.path, position); }
  };
  const pandit = matches(text, phrases.pandit);
  const login = matches(text, phrases.login);
  const signup = matches(text, phrases.signup);
  if (login) add(pandit ? destinations.panditLogin : destinations.login, phrases.login);
  if (signup) add(pandit ? destinations.pandit : destinations.signup, phrases.signup);
  add(destinations.kundali, phrases.kundali);
  add(destinations.muhurat, phrases.muhurat);
  const hasMuhurat = matches(text, phrases.muhurat);
  const separateOptions = matches(text, 'ya|aur|or|and|या|और');
  const hasPuja = matches(text, phrases.puja);
  if ((!hasMuhurat || separateOptions) && (hasPuja || (pandit && matches(text, 'book|bulao|booking|बुक|बुलाओ')))) add(destinations.puja, `${phrases.puja}|${phrases.pandit}`);
  if (!hasMuhurat || (hasPuja && separateOptions)) {
    for (const [pattern, service] of services) {
      if (matches(text, pattern)) {
        const index = found.findIndex(d => d.path === '/puja');
        if (index >= 0) found.splice(index, 1);
        add({ path: `/puja?q=${encodeURIComponent(service)}`, label: service }, pattern);
      }
    }
  }
  add(destinations.home, phrases.home);
  add(destinations.dashboard, phrases.dashboard);
  add(destinations.contact, phrases.contact);
  add(destinations.about, phrases.about);
  const informational = matches(text, 'kya hai|what is|meaning|matlab|क्या है|मतलब');
  if (!matches(text, actionPattern) && !informational) {
    let rest = text;
    for (const pattern of [...Object.values(phrases), ...services.map(item => item[0]), 'please|page|us|my|mera|meri|mujhe|ji|hai|wala|wali|shanti|dosha|kuber|maha|ya|aur|or|and|wapas|wapis|back to|back|go|मेरी|मुझे|जी|पेज|है|या|और|वापस']) rest = rest.replace(new RegExp(pattern, 'giu'), ' ');
    if (rest.replace(/[^\p{L}\p{M}\p{N}]+/gu, '').length) return unknown();
  }
  if (pandit && !found.length) return { kind: 'clarify', text: 'Panditji book karne hain, registration karna hai, ya pandit login kholna hai?', choices: [destinations.puja, destinations.pandit, destinations.panditLogin] };
  if (found.length > 1) return { kind: 'clarify', text: 'Ek se zyada pages mile. Pehle kaunsa kholun?', choices: found.sort((a, b) => order.get(a.path)! - order.get(b.path)!) };
  if (found.length === 1) {
    if (informational) return { kind: 'clarify', text: `Main yahan page navigation mein madad kar sakta hoon. ${found[0].label} page kholun? “Haan” ya “nahi” bataiye.`, choices: found };
    return go(found[0]);
  }
  if (pending.length && matches(text, 'haan|yes|वही|हाँ|हां')) return { kind: 'clarify', text: 'Kaunsa option? Uska naam, “pehla” ya “dusra” bataiye.', choices: pending };
  return { kind: 'unknown', text: 'Page samajh nahi aaya. “Kundali banao”, “Puja dikhao”, “Muhurat khol do” ya “madad” likhiye.' };
}
