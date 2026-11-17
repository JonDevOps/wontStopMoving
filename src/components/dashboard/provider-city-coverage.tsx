'use client';
import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { MOVER_REGIONS } from '@/lib/mover-regions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Explicit coverage also supports cities without a reliable search-center coordinate. */
export function ProviderCityCoverage() {
  const db = useFirestore(), {user} = useUser();
  const ref = useMemoFirebase(() => db && user ? doc(db,'providers',user.uid) : null,[db,user]);
  const {data: provider} = useDoc(ref);
  const [selected,setSelected] = useState<string[]>([]), [region,setRegion] = useState(''), [city,setCity] = useState('');
  const [cities,setCities] = useState<{name:string;slug:string}[]>([]), [loading,setLoading] = useState(false), [saving,setSaving] = useState(false), [message,setMessage] = useState('');
  useEffect(() => { if(provider) setSelected(Array.isArray(provider.serviceAreaCities) ? provider.serviceAreaCities.filter((value:unknown)=>typeof value==='string') : []); },[provider]);
  useEffect(() => {
    if(!region) return;
    const controller = new AbortController(); setLoading(true);
    fetch(`/api/movers/locations?region=${region}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(data=>setCities(data.cities)).catch(error=>{if(error.name!=='AbortError')setMessage('Could not load cities. Please try again.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[region]);
  async function save() {
    if(!ref) return;
    setSaving(true);setMessage('');
    try { await updateDoc(ref,{serviceAreaCities:selected});setMessage('Service cities saved.'); }
    catch {setMessage('Could not save service cities. Please try again.');}
    finally {setSaving(false);}
  }
  const control='w-full min-h-12 border rounded-xl p-3 bg-white';
  return <section className="bg-white rounded-2xl border p-6 space-y-4"><h2 className="text-xl font-bold">Cities you serve</h2><p className="text-sm">Your saved service location appears in nearby searches within 50 miles. Add other cities you serve, including places without a mapped city center. Add only cities where you can complete jobs at your advertised rate.</p>
    <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="coverage-region">State or province</Label><select id="coverage-region" className={control} value={region} onChange={e=>{setRegion(e.target.value);setCity('');setCities([]);setMessage('');}}><option value="">Choose a state or province</option>{Object.entries(MOVER_REGIONS).sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="coverage-city">City</Label><select id="coverage-city" className={control} disabled={!region||loading} value={city} onChange={e=>setCity(e.target.value)}><option value="">{loading?'Loading cities…':'Choose a city'}</option>{cities.map(place=><option key={place.slug} value={place.slug}>{place.name}</option>)}</select></div></div>
    <Button type="button" variant="outline" disabled={!city||selected.length>=100||selected.includes(`${region}/${city}`)} onClick={()=>setSelected([...selected,`${region}/${city}`])}>Add service city</Button>
    <ul className="flex flex-wrap gap-2">{selected.map(key=><li key={key}><button type="button" className="rounded-full border px-3 py-2 text-sm" onClick={()=>setSelected(selected.filter(value=>value!==key))} aria-label={`Remove ${key}`}>{key.split('/').reverse().join(', ').replace(/-/g,' ')} ×</button></li>)}</ul>
    <Button type="button" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save service cities'}</Button>{message&&<p role="status">{message}</p>}
  </section>;
}
