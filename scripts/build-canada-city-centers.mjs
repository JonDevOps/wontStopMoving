// Source: https://download.geonames.org/export/dump/CA.zip (CC BY 4.0).
// Run at the repository root with the extracted CA.txt file as the argument.
import { readFileSync, writeFileSync } from 'node:fs';
import { CITIES_BY_STATE, slugify } from '../src/lib/location-data.ts';
import { MOVER_REGIONS } from '../src/lib/mover-regions.ts';

if (!process.argv[2]) throw new Error('Usage: node scripts/build-canada-city-centers.mjs /path/to/CA.txt');
const provinces = { '01':'ab', '02':'bc', '03':'mb', '04':'nb', '05':'nl', '07':'ns', '08':'on', '09':'pe', '10':'qc', '11':'sk', '12':'yt', '13':'nt' };
const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bsaint\b/g, 'st').replace(/[^a-z0-9]/g, '');
const candidates = new Map();
for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  const fields = line.split('\t'), region = provinces[fields[10]];
  if (fields[6] !== 'P' || !region || ['PPLH','PPLQ'].includes(fields[7])) continue;
  const point = [Number(fields[4]), Number(fields[5])], population = Number(fields[14] || 0);
  if (!point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) continue;
  for (const name of [fields[1], fields[2], ...(fields[3] || '').split(',')].filter(Boolean)) {
    const key = `${region}/${normalize(name)}`;
    if (!candidates.has(key) || population > candidates.get(key).population) candidates.set(key, { point, population });
  }
}
const output = {}, missing = [];
for (const region of Object.values(provinces)) {
  const name = region === 'nl' ? 'Newfoundland' : region === 'nt' ? 'Northwest Territory' : MOVER_REGIONS[region];
  for (const city of CITIES_BY_STATE[slugify(name)] || []) {
    const candidate = candidates.get(`${region}/${normalize(city)}`);
    if (candidate) output[`${region}/${slugify(city)}`] = candidate.point;
    else missing.push(`${region}/${city}`);
  }
}
writeFileSync('src/data/canada-city-centers.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ matched: Object.keys(output).length, missing }));
