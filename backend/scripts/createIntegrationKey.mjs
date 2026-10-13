// Creates a key for one system that will call the Integration API
// (src/routes/integration.ts), for example the Unified Central Record
// Management System.
//
//   node scripts/createIntegrationKey.mjs vucrms
//
// Prints the key once (give it to the calling system, it is not stored
// anywhere) and the line to add to INTEGRATION_API_KEYS in the AICS
// environment file. Several systems: separate their entries with commas.
import { createHash, randomBytes } from 'node:crypto'

const name = (process.argv[2] ?? '').trim().toLowerCase()
if (!/^[a-z0-9_-]{1,40}$/.test(name)) {
  console.error('Usage: node scripts/createIntegrationKey.mjs <name>   (letters, digits, - and _ only)')
  process.exit(1)
}

const key = `aics_${randomBytes(32).toString('base64url')}`
const hash = createHash('sha256').update(key).digest('hex')

console.log(`Key for "${name}" (shown only now, keep it secret):\n  ${key}\n`)
console.log(`Add to the AICS environment file, then restart the backend:\n  INTEGRATION_API_KEYS=${name}:${hash}`)
