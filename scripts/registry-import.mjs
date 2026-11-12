#!/usr/bin/env node
/**
 * Imports the FMCSA Company Census file (the full ~2 GB CSV from
 * data.transportation.gov, refreshed by the DOT every day) into the mover
 * registry, instead of paging the open-data API one state at a time (which
 * hits rate limits). Runs in GitHub Actions (.github/workflows/registry-import.yml).
 *
 *   node scripts/registry-import.mjs check                 → is an import due? (daily for the first 3, then weekly)
 *   node scripts/registry-import.mjs run --census c.csv --authority a.csv [--dictionary d.pdf] [--source-updated <unix>]
 *
 * Writes to Firebase Storage (bucket STORAGE_BUCKET, Google credentials from
 * the environment), or to a local folder with --out <dir> / REGISTRY_LOCAL_DIR:
 * (paths under registry/v1/):
 *   import/movers/{ST}.json.gz      household-goods carriers per state (raw census rows + authority), which the app's
 *                                   registry sync turns into the mover registry, a few states every 15 minutes
 *   carriers/{ST}/{category}.json.gz every active for-hire carrier, by category (see src/lib/carriers.ts)
 *   import/data-dictionary.pdf      the DOT's data dictionary, when it changes
 *   import/manifest.json            when, how many, what changed
 */
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { CATEGORY_KEYS, categoriesOf, columnChanges, hasCategory, importDue, keepCarrier, preferAuthority, REQUIRED_COLUMNS, toCarrierTuple } from '../src/lib/carriers.ts';
import { isProvince, REGISTRY_AREAS } from '../src/lib/registry.ts';

const args = process.argv.slice(2);
const mode = args[0];
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const outDir = opt('out') || process.env.REGISTRY_LOCAL_DIR;

// ---- Storage (Firebase bucket, or a local folder) ----
let bucket = null;
async function getBucket() {
  if (bucket) return bucket;
  // The Cloud Storage client (installed with firebase-admin) uses Google's default credentials, including GitHub's keyless sign-in.
  const { Storage } = await import('@google-cloud/storage');
  const name = process.env.STORAGE_BUCKET;
  if (!name) throw new Error('Set STORAGE_BUCKET (or --out for a local folder).');
  bucket = new Storage().bucket(name);
  return bucket;
}
async function readObject(name) {
  if (outDir) return readFile(path.join(outDir, name)).catch(() => null);
  const file = (await getBucket()).file(`registry/v1/${name}`);
  const [exists] = await file.exists();
  return exists ? (await file.download())[0] : null;
}
async function writeObject(name, data, contentType) {
  if (outDir) { await mkdir(path.dirname(path.join(outDir, name)), { recursive: true }); await writeFile(path.join(outDir, name), data); return; }
  await (await getBucket()).file(`registry/v1/${name}`).save(data, { contentType, resumable: data.length > 8 * 1024 * 1024, metadata: { cacheControl: 'private, max-age=0' } });
}
const MANIFEST = 'import/manifest.json';
const readManifest = async () => { const b = await readObject(MANIFEST); return b ? JSON.parse(b.toString('utf8')) : null; };

// ---- Streaming CSV (quoted fields, commas and newlines inside quotes) ----
async function* csvRows(file) {
  let row = [], field = '', quoted = false, pendingQuote = false;
  for await (const chunk of createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (pendingQuote) { // Saw a quote inside a quoted field: "" is an escaped quote, anything else ends the field.
        pendingQuote = false;
        if (c === 34) { field += '"'; start = i + 1; continue; }
        quoted = false;
      }
      if (quoted) { if (c === 34) { field += chunk.slice(start, i); start = i + 1; pendingQuote = true; } continue; }
      if (c === 34) { field += chunk.slice(start, i); start = i + 1; quoted = true; }
      else if (c === 44) { row.push(field + chunk.slice(start, i)); field = ''; start = i + 1; }
      else if (c === 10) { row.push((field + chunk.slice(start, i)).replace(/\r$/, '')); field = ''; start = i + 1; yield row; row = []; }
    }
    field += chunk.slice(start);
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); yield row; }
}
async function* records(file, onHeader) {
  let header = null;
  for await (const r of csvRows(file)) {
    if (!header) { header = r.map(h => h.trim().toLowerCase()); onHeader?.(header); continue; }
    if (r.length === 1 && r[0] === '') continue;
    const o = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i];
    yield o;
  }
}

async function check() {
  const prev = await readManifest();
  const force = process.env.FORCE_IMPORT === 'true';
  const d = force ? { due: true, reason: 'run by hand' } : importDue(prev);
  console.log(JSON.stringify({ ...d, lastImport: prev?.generatedAt || null, runs: prev?.runs || 0 }));
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `due=${d.due}\n`);
}

async function run() {
  const censusFile = opt('census'), authorityFile = opt('authority'), dictionaryFile = opt('dictionary');
  if (!censusFile || !authorityFile) throw new Error('Pass --census and --authority files.');
  const started = Date.now(), prev = await readManifest();

  // 1. Operating authority (MC numbers, household-goods authority), by DOT number.
  const authority = new Map();
  for await (const a of records(authorityFile)) {
    if (!(a.hhg_chk === 'Y' || a.common_stat === 'A' || a.broker_stat === 'A')) continue;
    const dot = String(Number(a.dot_number || 0));
    authority.set(dot, preferAuthority(authority.get(dot), { mc: String(a.docket_number || ''), hhg: a.hhg_chk === 'Y', active: a.common_stat === 'A', broker: a.broker_stat === 'A' }));
  }
  console.log(`Authority: ${authority.size.toLocaleString()} carriers`);

  // 2. The census: movers (as today's registry) and every for-hire carrier, per state.
  const areas = new Set(REGISTRY_AREAS), movers = new Map(), carriers = new Map(), cats = new Map();
  let header = [], total = 0, active = 0;
  const keep = new Set(REQUIRED_COLUMNS);
  for await (const r of records(censusFile, h => { header = h; })) {
    total++;
    if (total % 500_000 === 0) console.log(`  ${total.toLocaleString()} rows read`);
    if (total === 1) { const ch = columnChanges(header); if (ch.missingRequired.length) throw new Error(`The census file is missing columns: ${ch.missingRequired.join(', ')}`); }
    if (r.status_code !== 'A') continue;
    active++;
    const st = String(r.phy_state || '').toUpperCase();
    if (!areas.has(st) || (isProvince(st) && r.phy_country !== 'CA')) continue;
    const dot = String(Number(r.dot_number || 0)), auth = authority.get(dot);
    if (r.crgo_household === 'X') {
      const row = {};
      for (const k in r) if (keep.has(k) || k.startsWith('crgo_')) row[k] = r[k];
      if (auth) Object.assign(row, { auth_mc: auth.mc, auth_hhg: auth.hhg ? 'Y' : '', auth_active: auth.active ? 'Y' : '', auth_broker: auth.broker ? 'Y' : '' });
      (movers.get(st) || movers.set(st, []).get(st)).push(row);
    }
    if (keepCarrier(r)) {
      const t = toCarrierTuple(r, auth);
      (carriers.get(st) || carriers.set(st, []).get(st)).push(t);
      const c = cats.get(st) || cats.set(st, {}).get(st);
      for (const k of categoriesOf(t[13])) c[k] = (c[k] || 0) + 1;
    }
  }
  console.log(`Census: ${total.toLocaleString()} rows, ${active.toLocaleString()} active`);

  // 3. Write per-state files.
  const counts = {};
  for (const st of REGISTRY_AREAS) {
    const m = movers.get(st) || [], c = carriers.get(st) || [];
    counts[st] = { movers: m.length, carriers: c.length, categories: cats.get(st) || {} };
    await writeObject(`import/movers/${st}.json.gz`, gzipSync(Buffer.from(JSON.stringify(m))), 'application/gzip');
    // One file per category (a carrier is in each it hauls for), so the app loads only what it shows.
    for (const k of CATEGORY_KEYS) await writeObject(`carriers/${st}/${k}.json.gz`, gzipSync(Buffer.from(JSON.stringify(c.filter(t => hasCategory(t[13], k))))), 'application/gzip');
  }

  // 4. The data dictionary PDF: store it when it changes.
  let dictionary = prev?.dictionary || null;
  if (dictionaryFile) {
    const pdf = await readFile(dictionaryFile);
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const name = process.env.DICTIONARY_NAME || path.basename(dictionaryFile);
    const changed = sha256 !== dictionary?.sha256;
    if (changed) await writeObject('import/data-dictionary.pdf', pdf, 'application/pdf');
    dictionary = { name, sha256, bytes: pdf.length, changedAt: changed ? new Date().toISOString() : dictionary.changedAt, checkedAt: new Date().toISOString(), previousName: changed ? dictionary?.name || null : dictionary?.previousName || null };
  }

  const totals = { rows: total, active, movers: 0, carriers: 0, categories: {} };
  for (const v of Object.values(counts)) { totals.movers += v.movers; totals.carriers += v.carriers; for (const [k, n] of Object.entries(v.categories)) totals.categories[k] = (totals.categories[k] || 0) + n; }
  const manifest = {
    generatedAt: new Date().toISOString(), firstImportAt: prev?.firstImportAt || new Date().toISOString(), runs: (prev?.runs || 0) + 1,
    sourceUpdatedAt: opt('source-updated') ? new Date(Number(opt('source-updated')) * 1000).toISOString() : null,
    seconds: Math.round((Date.now() - started) / 1000), columns: { ...columnChanges(header), count: header.length }, totals, counts, dictionary,
  };
  await writeObject(MANIFEST, Buffer.from(JSON.stringify(manifest, null, 1)), 'application/json');
  console.log(JSON.stringify({ ...manifest, counts: undefined }, null, 1));
}

if (mode === 'check') await check();
else if (mode === 'run') await run();
else { console.error('Usage: registry-import.mjs check | run --census <csv> --authority <csv> [--dictionary <pdf>] [--out <dir>]'); process.exit(2); }
