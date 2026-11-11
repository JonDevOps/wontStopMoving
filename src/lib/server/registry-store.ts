import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adminBucket } from './firebase-admin';
import type { Mover } from '@/lib/registry';

/**
 * Registry files: one gzipped JSON array of movers per state at
 * registry/v1/{ST}.json.gz in Firebase Storage (never public; only the
 * server reads them). Kept in memory per server instance for 30 minutes,
 * a few states at a time. REGISTRY_LOCAL_DIR swaps Storage for a local
 * folder (tests and local runs).
 */
const PREFIX = 'registry/v1';
const TTL = 30 * 60_000, MAX_STATES = 12;
const cache = new Map<string, { at: number; rows: Mover[] }>();

const localDir = () => process.env.REGISTRY_LOCAL_DIR;

async function readFileBytes(name: string): Promise<Buffer | null> {
  if (localDir()) return readFile(path.join(localDir()!, name)).catch(() => null);
  const file = (await adminBucket()).file(`${PREFIX}/${name}`);
  const [exists] = await file.exists();
  return exists ? (await file.download())[0] : null;
}

async function writeFileBytes(name: string, data: Buffer, contentType: string) {
  if (localDir()) { await mkdir(localDir()!, { recursive: true }); await writeFile(path.join(localDir()!, name), data); return; }
  await (await adminBucket()).file(`${PREFIX}/${name}`).save(data, { contentType, resumable: false, metadata: { cacheControl: 'private, max-age=0' } });
}

export async function loadState(state: string): Promise<Mover[]> {
  const hit = cache.get(state);
  if (hit && Date.now() - hit.at < TTL) { cache.delete(state); cache.set(state, hit); return hit.rows; }
  const bytes = await readFileBytes(`${state}.json.gz`);
  const rows: Mover[] = bytes ? JSON.parse(gunzipSync(bytes).toString('utf8')) : [];
  cache.set(state, { at: Date.now(), rows });
  while (cache.size > MAX_STATES) cache.delete(cache.keys().next().value!);
  return rows;
}

export async function saveState(state: string, rows: Mover[]) {
  await writeFileBytes(`${state}.json.gz`, gzipSync(Buffer.from(JSON.stringify(rows))), 'application/gzip');
  cache.set(state, { at: Date.now(), rows });
}

export async function loadStates(states: string[]): Promise<Mover[]> {
  const out: Mover[] = [];
  for (const s of states) out.push(...(await loadState(s)));
  return out;
}
