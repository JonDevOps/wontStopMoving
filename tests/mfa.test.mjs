import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedSecondFactor, mfaErrorMessage } from '../src/lib/mfa.ts';

test('only supported Firebase MFA claims grant a verified session', () => {
  for (const firebase of [undefined, {}, { sign_in_second_factor: true }, { sign_in_second_factor: '' }, { sign_in_second_factor: 'password' }, { twoFactorEnabled: true }]) {
    assert.equal(hasVerifiedSecondFactor(firebase), false);
  }
  assert.equal(hasVerifiedSecondFactor({ sign_in_second_factor: 'totp' }), true);
  assert.equal(hasVerifiedSecondFactor({ sign_in_second_factor: 'phone' }), true);
});

test('authentication errors do not expose raw provider messages or credentials', () => {
  assert.equal(mfaErrorMessage({ message: 'sensitive details' }).includes('sensitive'), false);
  assert.match(mfaErrorMessage({ code: 'auth/invalid-verification-code' }), /incorrect, expired, or already used/);
  assert.match(mfaErrorMessage({ code: 'auth/too-many-requests' }), /wait/);
});
