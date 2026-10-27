import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNavigationTarget, resolveNavigationMessage, isPanditNavigation, uniqueServiceForBooking } from '../src/lib/conversation-navigation.ts';

test('Hindi, Hinglish and English requests resolve real page routes', () => {
  for (const [message, path] of [
    ['mujhe kundali banwani hai', '/kundali-creation'], ['मेरी कुंडली बनाओ', '/kundali-creation'],
    ['puja book karni hai', '/puja'], ['पूजा दिखाओ', '/puja'], ['find an auspicious time', '/muhurat-finder'],
    ['मुहूर्त खोल दो', '/muhurat-finder'], ['home page kholo', '/'],
    ['pandit registration karna hai', '/sign-up?role=pandit'], ['पंडित के रूप में पंजीकरण', '/sign-up?role=pandit'],
    ['devotee signup kholo', '/sign-up'], ['pandit login', '/login?role=pandit'], ['login khol do', '/login'],
    ['mera account dikhao', '/dashboard'], ['contact page', '/#contact'], ['about us', '/#mission'],
    ['pandit book karna hai', '/puja'], ['Ganesh puja dikhao', '/puja?q=Ganesh%20Puja'],
  ]) {
    const result = resolveNavigationMessage(message);
    assert.equal(result.kind, 'navigate', message);
    assert.equal(result.destination.path, path, message);
  }
});

test('ambiguous requests retain choices and accept contextual followups', () => {
  const ambiguous = resolveNavigationMessage('kundali ya muhurat dikhao');
  assert.equal(ambiguous.kind, 'clarify');
  assert.equal(ambiguous.choices.length, 2);
  assert.equal(resolveNavigationMessage('dusra', ambiguous.choices).destination.path, '/muhurat-finder');
  assert.equal(resolveNavigationMessage('haan', ambiguous.choices).kind, 'clarify');
  const question = resolveNavigationMessage('kundali kya hai');
  assert.equal(question.kind, 'clarify');
  assert.equal(resolveNavigationMessage('haan khol do', question.choices).destination.path, '/kundali-creation');
  assert.equal(resolveNavigationMessage('haan puja dikhao', question.choices).destination.path, '/puja');
  assert.equal(resolveNavigationMessage('pandit').kind, 'clarify');
});

test('negative, unsupported and personal-detail messages do not navigate', () => {
  for (const message of ['kundali mat kholo', 'puja nahi chahiye', "don't open login", 'कुंडली नहीं खोलो', 'cancel']) {
    assert.equal(resolveNavigationMessage(message).kind, 'cancel', message);
  }
  for (const message of ['', 'my name is Test', 'meri date of birth 15/08/1995', 'https://example.com', 'homepagefake']) {
    assert.equal(resolveNavigationMessage(message).kind, 'unknown', message);
  }
  assert.equal(resolveNavigationMessage('wapas jao').kind, 'back');
  assert.equal(resolveNavigationMessage('madad').kind, 'help');
});

test('AI targets are restricted to real internal routes and supported query parameters', () => {
  for (const value of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', 'javascript:alert(1)', '/missing', null, {}]) {
    assert.equal(normalizeNavigationTarget(value), null);
  }
  assert.equal(normalizeNavigationTarget('/profile'), '/dashboard');
  assert.equal(normalizeNavigationTarget('/contact'), '/#contact');
  assert.equal(normalizeNavigationTarget('/about'), '/#mission');
  assert.equal(normalizeNavigationTarget('/signup?role=pandit'), '/sign-up?role=pandit');
  assert.equal(normalizeNavigationTarget('/login?next=https://evil.invalid'), '/login');
  assert.equal(normalizeNavigationTarget('/services?q=Ganesh&city=Delhi'), '/puja?q=Ganesh&city=Delhi');
});

test('normal signup and pandit login never trigger pandit onboarding', () => {
  assert.equal(isPanditNavigation(null, '/signup'), false);
  assert.equal(isPanditNavigation(null, '/sign-up'), false);
  assert.equal(isPanditNavigation(null, '/login?role=pandit'), false);
  assert.equal(isPanditNavigation(null, '/signup?role=pandit'), true);
  assert.equal(isPanditNavigation('PANDIT_ONBOARDING', null), true);
  assert.equal(isPanditNavigation(null, null, 'pandit-first-name'), true);
});

test('booking navigation selects the requested title rather than the first description match', () => {
  const services = [
    { title: 'Griha Pravesh Puja & Havan', description: 'Lord Ganesh blessings' },
    { title: 'Ganesh Puja & Havan', description: 'A ceremony' },
  ];
  assert.equal(uniqueServiceForBooking(services, 'Ganesh Puja'), services[1]);
  assert.equal(uniqueServiceForBooking(services, 'Puja'), undefined);
  assert.equal(uniqueServiceForBooking(services, ''), undefined);
  assert.equal(uniqueServiceForBooking(services, 'Unknown Puja'), undefined);
});

test('choices follow the order spoken and all offered ordinals can be selected', () => {
  const reply = resolveNavigationMessage('muhurat ya kundali dikhao');
  assert.deepEqual(reply.choices.map(choice => choice.path), ['/muhurat-finder', '/kundali-creation']);
  assert.equal(resolveNavigationMessage('pehla wala kholo', reply.choices).destination.path, '/muhurat-finder');
  const help = resolveNavigationMessage('madad');
  assert.equal(resolveNavigationMessage('teesra kholo', help.choices).destination.path, '/muhurat-finder');
  assert.equal(resolveNavigationMessage('number 5', help.choices).destination.path, '/login');
  assert.equal(resolveNavigationMessage('आखिरी', help.choices).destination.path, '/login');
  assert.equal(resolveNavigationMessage('muhurat ya kundali').kind, 'clarify');
  assert.equal(resolveNavigationMessage('home wapas jao').destination.path, '/');
});

test('unimplemented tools never pretend to open a different tool', () => {
  for (const text of ['rashifal dikhao', 'Panchang kholo', 'gemstone guide', 'चौघड़िया दिखाओ']) {
    const reply = resolveNavigationMessage(text);
    assert.equal(reply.kind, 'unavailable');
    assert.equal(reply.destination, undefined);
  }
});

test('a corrected request navigates only to the positive clause', () => {
  for (const message of ['kundali nahi, puja kholo', 'kundali nahi puja kholo', "don't open kundali, open puja", 'कुंडली नहीं, पूजा खोलो']) {
    assert.equal(resolveNavigationMessage(message).destination.path, '/puja', message);
  }
  assert.equal(resolveNavigationMessage('puja ka muhurat dikhao').destination.path, '/muhurat-finder');
});

test('personal details and discussion do not become navigation commands just because a name matches a service', () => {
  for (const message of ['mera naam Ganesh hai', 'my name is Ganesh', 'मैं गणेश हूँ', 'I am reading about kundali', 'mera email ganesh@example.com hai', 'mera email login@example.invalid hai', 'mera naam Login hai']) {
    assert.equal(resolveNavigationMessage(message).kind, 'unknown', message);
  }
  assert.equal(resolveNavigationMessage('Laxmi Kuber puja dikhao').destination.path, '/puja?q=Laxmi%20Kuber');
  assert.equal(resolveNavigationMessage('navgraha shanti kholo').destination.path, '/puja?q=Navgraha%20Shanti');
});
