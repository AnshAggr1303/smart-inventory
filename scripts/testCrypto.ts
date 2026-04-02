// Quick smoke-test for AES-256-GCM encrypt/decrypt.
// Run with: npx ts-node scripts/testCrypto.ts

// Set a test secret before importing — encryptKey reads process.env at call time.
// Must be exactly 32 characters (Rule S6 / encryptKey validation).
process.env.ENCRYPTION_SECRET = 'test-secret-key-1234567890123456'

// Use a relative path — ts-node doesn't resolve the @/ alias without tsconfig-paths.
import { encryptKey, decryptKey } from '../lib/crypto/encryptKey'

const PLAINTEXT = 'test-api-key-123'

const encrypted = encryptKey(PLAINTEXT)
const decrypted = decryptKey(encrypted)

console.log('Plaintext :', PLAINTEXT)
console.log('Encrypted :', encrypted)
console.log('Decrypted :', decrypted)

if (decrypted !== PLAINTEXT) {
  console.error('FAIL — decrypted value does not match original')
  process.exit(1)
}

console.log('PASS — encrypt → decrypt round-trip successful')
