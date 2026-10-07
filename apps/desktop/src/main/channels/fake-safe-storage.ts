/**
 * Test double of Electron's `safeStorage` (XOR with a fixed byte + a marker), so tests never touch
 * the OS keychain/DPAPI. The ciphertext never contains the plain text. Test-only module.
 */
import type { SafeStorageLike } from './channel-secrets.js';

const MARKER = Buffer.from('FAKE1:');
const KEY = 0x5a;

export interface FakeSafeStorage extends SafeStorageLike {
  available: boolean;
  backend: string;
  encryptCalls: number;
}

export function fakeSafeStorage(available = true, backend = 'gnome_libsecret'): FakeSafeStorage {
  const storage: FakeSafeStorage = {
    available,
    backend,
    encryptCalls: 0,
    isEncryptionAvailable: () => storage.available,
    getSelectedStorageBackend: () => storage.backend,
    encryptString: (plainText) => {
      storage.encryptCalls += 1;
      const bytes = Buffer.from(plainText, 'utf8').map((byte) => byte ^ KEY);
      return Buffer.concat([MARKER, bytes]);
    },
    decryptString: (encrypted) => {
      if (!encrypted.subarray(0, MARKER.length).equals(MARKER)) {
        throw new Error('Error while decrypting the ciphertext provided to safeStorage');
      }
      return Buffer.from(encrypted.subarray(MARKER.length).map((byte) => byte ^ KEY)).toString(
        'utf8',
      );
    },
  };
  return storage;
}
