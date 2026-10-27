import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNavigationTarget, isPanditNavigation, uniqueServiceForBooking, isGreetingOnlyResponse } from '../src/lib/conversation-navigation.ts';

test('a welcome phrase in a voice navigation or form reply preserves its action', () => {
  assert.equal(isGreetingOnlyResponse('NAVIGATE', 'NAVIGATE', 'Namaste! Pandit registration khol raha hoon.'), false);
  assert.equal(isGreetingOnlyResponse('FILL_FORM', 'PANDIT_ONBOARDING', 'Om Namah Shivaya!'), false);
  assert.equal(isGreetingOnlyResponse(null, 'GREETING', 'Namaste!'), true);
  assert.equal(isGreetingOnlyResponse(null, 'CHAT', 'Aapki kya seva karun?'), false);
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
