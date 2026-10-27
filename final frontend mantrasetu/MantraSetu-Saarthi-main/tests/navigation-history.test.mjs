import test from 'node:test';
import assert from 'node:assert/strict';
import { recordNavigation, canGoBack } from '../src/lib/navigation-history.ts';

test('browser Back and Forward move the assistant history cursor instead of adding pages', () => {
  let history = { entries: [{ key: 'home', path: '/' }], index: 0 };
  history = recordNavigation(history, { key: 'kundali', path: '/kundali-creation' }, 'PUSH');
  history = recordNavigation(history, { key: 'puja', path: '/puja' }, 'PUSH');
  history = recordNavigation(history, { key: 'kundali', path: '/kundali-creation' }, 'POP');
  assert.equal(history.index, 1);
  assert.equal(history.entries[history.index - 1].path, '/');
  history = recordNavigation(history, { key: 'puja', path: '/puja' }, 'POP');
  assert.equal(history.index, 2);
});

test('new navigation after Back discards forward entries; auth redirect replaces its entry', () => {
  let history = { entries: [{ key: 'home', path: '/' }, { key: 'old', path: '/puja' }], index: 0 };
  history = recordNavigation(history, { key: 'account', path: '/dashboard' }, 'PUSH');
  history = recordNavigation(history, { key: 'login', path: '/login' }, 'REPLACE');
  assert.deepEqual(history.entries.map(item => item.path), ['/', '/login']);
  assert.equal(canGoBack(history), true);
});

test('a direct link or unknown browser entry cannot send assistant Back outside its known session', () => {
  let history = { entries: [{ key: 'direct', path: '/puja' }], index: 0 };
  assert.equal(canGoBack(history), false);
  history = recordNavigation(history, { key: 'unknown', path: '/' }, 'POP');
  assert.equal(canGoBack(history), false);
});
