// Read-only: looks for case numbers in the admin backups (backups/aics-backup-*.json.gz)
// and reports, per case number, the newest backup that still has it.
// Changes nothing.
//
// Run on the server (the backups live in the backend container):
//   sudo docker compose --env-file .env.production -f docker-compose.production.yml \
//     exec -T -e CASES="MD-AICS-VGN-2500,BUR-AICS-VGN-195" backend node - < backend/scripts/find-deleted-cases.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const wanted = new Set(String(process.env.CASES ?? '').split(',').map((v) => v.trim()).filter(Boolean))
if (wanted.size === 0) {
  console.error('Set CASES to a comma-separated list of case numbers.')
  process.exit(1)
}

const dir = path.resolve(process.env.BACKUPS_DIR ?? 'backups')
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.startsWith('aics-backup-') && f.endsWith('.json.gz')).sort().reverse()
  : []
if (files.length === 0) {
  console.error(`No backups found in ${dir}.`)
  process.exit(1)
}

const found = new Map()
for (const file of files) {
  if (found.size === wanted.size) break
  let snapshot
  try {
    snapshot = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, file))).toString('utf8'))
  } catch (err) {
    console.error(`Skipping ${file}: ${err.message}`)
    continue
  }
  const db = snapshot.database ?? {}
  const clients = new Map((db.clients ?? []).map((c) => [c.id, c]))
  for (const c of db.cases ?? []) {
    if (!wanted.has(c.caseNumber) || found.has(c.caseNumber)) continue
    const client = clients.get(c.clientId) ?? {}
    found.set(c.caseNumber, {
      backup: file,
      status: c.status,
      client: [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' '),
      maker: c.socialWorkerName ?? '',
      created: String(c.createdAt ?? '').slice(0, 10),
    })
  }
}

console.log(`Searched ${files.length} backup(s) in ${dir}, newest first.\n`)
for (const number of wanted) {
  const hit = found.get(number)
  console.log(hit
    ? `${number} | ${hit.status} | ${hit.client} | maker: ${hit.maker} | created ${hit.created} | in ${hit.backup}`
    : `${number} | not in any backup`)
}
