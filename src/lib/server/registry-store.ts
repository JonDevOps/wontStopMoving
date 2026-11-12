import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adminBucket } from './firebase-admin';
import type { Mover } from '@/lib/registry';
import type { CarrierTuple } from '@/lib/carriers';

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

/**
 * Nationwide view: a light file per state with only likely movers
 * (registry/v1/{ST}.lite.json.gz), read together and cached for 30 minutes.
 * Lets the map and lists cover every mover in the country without loading
 * every full state file.
 */
let national: { at: number; rows: Mover[]; states: string[] } | null = null;

export async function saveLite(state: string, rows: Mover[]) {
  const lite = rows.filter(m => m.likelyMover);
  await writeFileBytes(`${state}.lite.json.gz`, gzipSync(Buffer.from(JSON.stringify(lite))), 'application/gzip');
  national = null;
}

export async function loadNational(states: string[]): Promise<{ rows: Mover[]; states: string[] }> {
  if (national && !localDir() && Date.now() - national.at < TTL) return national; // No caching for local (test) files.
  const parts = await Promise.all(states.map(async s => {
    const bytes = await readFileBytes(`${s}.lite.json.gz`).catch(() => null);
    return bytes ? { s, rows: JSON.parse(gunzipSync(bytes).toString('utf8')) as Mover[] } : null;
  }));
  const ok = parts.filter(Boolean) as { s: string; rows: Mover[] }[];
  national = { at: Date.now(), rows: ok.flatMap(p => p.rows), states: ok.map(p => p.s) };
  return national;
}

// ---- The census file import (scripts/registry-import.mjs) ----

export type ImportManifest = {
  generatedAt: string; firstImportAt: string; runs: number; sourceUpdatedAt: string | null; seconds: number;
  columns: { added: string[]; removed: string[]; missingRequired: string[]; count: number };
  totals: { rows: number; active: number; movers: number; carriers: number; partners?: number; newPartners?: number; categories: Record<string, number> };
  counts: Record<string, { movers: number; carriers: number; partners?: number; categories: Record<string, number> }>;
  dictionary: { name: string; sha256: string; bytes: number; changedAt: string; checkedAt: string; previousName: string | null } | null;
};

let manifestCache: { at: number; value: ImportManifest | null } | null = null;
/** The latest import's manifest, or null if the census file hasn't been imported yet. */
export async function loadManifest(force = false): Promise<ImportManifest | null> {
  if (!force && manifestCache && Date.now() - manifestCache.at < 60_000) return manifestCache.value;
  const bytes = await readFileBytes('import/manifest.json').catch(() => null);
  manifestCache = { at: Date.now(), value: bytes ? JSON.parse(bytes.toString('utf8')) : null };
  return manifestCache.value;
}

/** One state's household-goods rows from the imported census file (null if not imported). */
export async function loadImportedMovers(state: string): Promise<Record<string, string | undefined>[] | null> {
  const bytes = await readFileBytes(`import/movers/${state}.json.gz`).catch(() => null);
  return bytes ? JSON.parse(gunzipSync(bytes).toString('utf8')) : null;
}

export const loadDictionaryPdf = () => readFileBytes('import/data-dictionary.pdf');

/**
 * For-hire carriers in a state, one file per category: compact
 * tuples. Big states are large, so only ~250k rows stay cached at a time.
 */
const carrierCache = new Map<string, { at: number; rows: CarrierTuple[] }>();
export async function loadCarriers(state: string, type: string): Promise<CarrierTuple[]> {
  const key = `${state}/${type}`, hit = carrierCache.get(key);
  if (hit && Date.now() - hit.at < TTL) { carrierCache.delete(key); carrierCache.set(key, hit); return hit.rows; }
  const bytes = await readFileBytes(`carriers/${state}/${type}.json.gz`).catch(() => null);
  const rows: CarrierTuple[] = bytes ? JSON.parse(gunzipSync(bytes).toString('utf8')) : [];
  carrierCache.set(key, { at: Date.now(), rows });
  let cached = 0;
  for (const v of carrierCache.values()) cached += v.rows.length;
  while (cached > 250_000 && carrierCache.size > 1) { const [k, v] = carrierCache.entries().next().value!; carrierCache.delete(k); cached -= v.rows.length; }
  return rows;
}

/** A state's best partner candidates (top ~3,000 by partner score; small, so cached separately). */
const partnerCache = new Map<string, { at: number; rows: CarrierTuple[] }>();
export async function loadPartners(state: string): Promise<CarrierTuple[]> {
  const hit = partnerCache.get(state);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  const bytes = await readFileBytes(`carriers/${state}/partners.json.gz`).catch(() => null);
  const rows: CarrierTuple[] = bytes ? JSON.parse(gunzipSync(bytes).toString('utf8')) : [];
  partnerCache.set(state, { at: Date.now(), rows });
  while (partnerCache.size > 16) partnerCache.delete(partnerCache.keys().next().value!);
  return rows;
}

/** Partner candidates new since the previous import: [state, ...tuple] rows, best first. */
export type NewCarriers = { generatedAt: string; baseline: boolean; skipped: boolean; rows: [string, ...CarrierTuple][] };
export async function loadNewCarriers(): Promise<NewCarriers | null> {
  const bytes = await readFileBytes('import/new-carriers.json.gz').catch(() => null);
  return bytes ? JSON.parse(gunzipSync(bytes).toString('utf8')) : null;
}
