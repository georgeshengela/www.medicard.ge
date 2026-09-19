import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notificationResponseIsGranted, notificationResponseStatus } from './notificationPermission.js';

describe('notificationResponseIsGranted', () => {
  it('accepts Expo granted / status granted', () => {
    assert.equal(notificationResponseIsGranted({ granted: true, status: 'undetermined' }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'granted' }), true);
  });

  it('accepts iOS authorized, provisional, and ephemeral even when granted is false', () => {
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'undetermined', ios: { status: 2 } }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'denied', ios: { status: 3 } }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'undetermined', ios: { status: 4 } }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, ios: { status: 'provisional' } }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 2 }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'authorized' }), true);
    assert.equal(notificationResponseIsGranted({ granted: false, ios: { allowsAlert: true } }), true);
  });

  it('rejects denied, undetermined, and empty responses', () => {
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'denied', ios: { status: 1 } }), false);
    assert.equal(notificationResponseIsGranted({ granted: false, status: 'undetermined', ios: { status: 0 } }), false);
    assert.equal(notificationResponseIsGranted(null), false);
    assert.equal(notificationResponseIsGranted({}), false);
  });
});

describe('notificationResponseStatus', () => {
  it('maps iOS authorized to granted and explicit deny to denied', () => {
    assert.equal(notificationResponseStatus({ granted: false, ios: { status: 2 } }), 'granted');
    assert.equal(notificationResponseStatus({ granted: false, status: 'denied', ios: { status: 1 } }), 'denied');
    assert.equal(notificationResponseStatus({ granted: false, status: 'undetermined' }), 'undetermined');
  });
});
