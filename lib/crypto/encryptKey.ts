import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM encryption / decryption for API keys stored in the database.
// ENCRYPTION_SECRET must be exactly 32 characters — server only, never NEXT_PUBLIC_.
// Stored format:  iv:authTag:encryptedData  (all hex-encoded, colon-separated)

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getSecret(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error(
      'ENCRYPTION_SECRET environment variable is not set. ' +
      'Add a 32-character random string to your .env.local file.'
    )
  }
  if (secret.length !== 32) {
    throw new Error(
      `ENCRYPTION_SECRET must be exactly 32 characters. ` +
      `Got ${secret.length} characters.`
    )
  }
  return Buffer.from(secret, 'utf8')
}

export function encryptKey(plaintext: string): string {
  const key = getSecret()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptKey(ciphertext: string): string {
  const key = getSecret()
  const parts = ciphertext.split(':')

  if (parts.length !== 3) {
    throw new Error(
      'Malformed ciphertext: expected format iv:authTag:encryptedData'
    )
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string]
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
