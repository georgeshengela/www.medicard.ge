import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACEHOLDER_FULL_NAME, displayFirstName, isPlaceholderName, nameInitials, realFullName } from './displayName.ts';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (file: string) => readFileSync(join(repo, file), 'utf8');

test('phone and Apple sign-ups are never greeted as „Medicard“', () => {
  const user = { fullName: PLACEHOLDER_FULL_NAME };
  assert.equal(displayFirstName(user), '');
  assert.equal(realFullName(user), '');
  assert.equal(nameInitials(user), '');
  // Earlier onboarding saves copied the placeholder into the legal name too.
  assert.equal(displayFirstName(user, { legalName: PLACEHOLDER_FULL_NAME }), '');
  assert.equal(displayFirstName({ fullName: '  medicard   მომხმარებელი ' }), '');
  assert.equal(isPlaceholderName('Medicard მომხმარებელი'), true);
  assert.equal(isPlaceholderName('Medicard Nino'), false);
});

test('a real name is used: the legal name first, then the account name', () => {
  assert.equal(displayFirstName({ fullName: 'ნინო ბერიძე' }), 'ნინო');
  assert.equal(nameInitials({ fullName: 'nino beridze' }), 'NB');
  assert.equal(displayFirstName({ fullName: PLACEHOLDER_FULL_NAME }, { legalName: 'ანა კაპანაძე' }), 'ანა');
  assert.equal(displayFirstName({ fullName: 'Nino Beridze' }, { legalName: '  ' }), 'Nino');
  assert.equal(displayFirstName(null), '');
  assert.equal(displayFirstName({ fullName: null }, null), '');
});

test('the placeholder literal is the same in the app, the server and web /app', () => {
  const server = read('server/src/lib/socialAuth.js').match(/export const DEFAULT_SOCIAL_NAME = '([^']+)'/);
  assert.equal(server?.[1], PLACEHOLDER_FULL_NAME);
  const web = read('server/public/app/js/session.js').match(/export const PLACEHOLDER_NAME = '([^']+)'/);
  assert.equal(web?.[1], PLACEHOLDER_FULL_NAME);
  // Phone sign-up writes the same constant, never its own copy of the text.
  assert.doesNotMatch(read('server/src/routes/auth.routes.js'), /'Medicard მომხმარებელი'/);
});

test('every greeting and name line goes through the helper, never the raw account name', () => {
  const home = read('mobile/app/(tabs)/home.tsx');
  assert.match(home, /const firstName = displayFirstName\(user, extra\)/);
  assert.match(home, /initial=\{nameInitials\(user, extra\)/);
  assert.doesNotMatch(home, /fullName\?\.split\(|fullName\?\.slice\(/);
  const profile = read('mobile/app/(tabs)/profile.tsx');
  assert.match(profile, /\{ownName \|\| tx\('შენი პროფილი', 'Your profile'\)\}/);
  assert.doesNotMatch(profile, /\{user\?\.fullName\}|fullName\s*\?\.split\(/);
  assert.match(read('mobile/app/(auth)/profile-setup/analyzing.tsx'), /displayFirstName\(user, extra\)/);
  for (const file of ['mobile/app/symptoms/results.tsx', 'mobile/app/symptoms/search.tsx', 'mobile/app/symptoms/details.tsx', 'mobile/src/components/medi/MediChat.tsx']) {
    const src = read(file);
    assert.match(src, /displayFirstName\(user, healthProfile\?\.extraAnswers\)/, file);
    assert.doesNotMatch(src, /fullName\?\.(trim\(\)\.)?split\(/, file);
  }
  assert.match(read('mobile/src/lib/mediNotificationBrain.ts'), /firstName: displayFirstName\(user, health\?\.extraAnswers\)/);
  // Web /app: the side menu, the profile header and its name row.
  assert.match(read('server/public/app/js/main.js'), /h\('b', null, displayName\(\) \|\|/);
  const webProfile = read('server/public/app/js/pages/profile.js');
  assert.doesNotMatch(webProfile, /u\.fullName \|\| t\(|sub: u\.fullName/);
});
