'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export type MapPoint = [dot: string, lat: number, lng: number, name: string, units: number, state: string];
export type StateStat = { state: string; likely: number; units: number; center: [number, number] | null };
export type Bounds = { south: number; west: number; north: number; east: number; zoom: number };

/**
 * Free OpenStreetMap map: every company as a dot sized by fleet, clustered
 * (with counts) when zoomed out. Optional state-total bubbles instead.
 */
export function MoverMap({ points, stateStats, focus, onBounds, onSelect, onState, highlight, stateTotals = false }: {
  points: MapPoint[]; stateStats: StateStat[]; stateTotals?: boolean; focus: { lat: number; lng: number; zoom: number } | null;
  onBounds: (b: Bounds) => void; onSelect: (dot: string, state: string) => void; onState: (state: string) => void; highlight?: string | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const L = useRef<any>(null);
  const cb = useRef({ onBounds, onSelect, onState });
  cb.current = { onBounds, onSelect, onState };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import('leaflet')).default;
      (window as any).L = leaflet;
      await import('leaflet.markercluster');
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { center: [37.6, -122.1], zoom: 9, preferCanvas: true, worldCopyJump: true });
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Canadian postal areas &copy; <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0)' }).addTo(m);
      const report = () => { const b = m.getBounds(); cb.current.onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom: m.getZoom() }); };
      m.on('moveend', report);
      map.current = m;
      report();
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => { if (focus && map.current) map.current.setView([focus.lat, focus.lng], focus.zoom); }, [focus]);

  useEffect(() => {
    const leaflet = L.current, m = map.current;
    if (!leaflet || !m) return;
    if (layer.current) { m.removeLayer(layer.current); layer.current = null; }
    // Companies are always shown (clustered); state bubbles only when asked for.
    if (stateTotals) {
      const group = leaflet.layerGroup();
      const max = Math.max(1, ...stateStats.map(s => s.likely));
      for (const s of stateStats) {
        if (!s.center) continue;
        const r = 8 + 32 * Math.sqrt(s.likely / max);
        leaflet.circleMarker(s.center, { radius: r, color: '#ea580c', weight: 1, fillColor: '#f97316', fillOpacity: 0.45 })
          .bindTooltip(`<b>${s.state}</b><br>${s.likely.toLocaleString()} likely movers<br>${s.units.toLocaleString()} trucks`)
          .on('click', () => cb.current.onState(s.state)).addTo(group);
      }
      layer.current = group.addTo(m);
      return;
    }
    const cluster = (leaflet as any).markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 45 });
    for (const [dot, lat, lng, name, units, state] of points) {
      const big = units >= 20, mid = units >= 5;
      const mk = leaflet.circleMarker([lat + ((Number(dot) % 97) - 48) * 0.00012, lng + ((Number(dot) % 89) - 44) * 0.00012], {
        radius: big ? 9 : mid ? 6 : 4, weight: dot === highlight ? 3 : 1, color: dot === highlight ? '#1d4ed8' : '#0f172a',
        fillColor: big ? '#dc2626' : mid ? '#f97316' : '#64748b', fillOpacity: 0.85,
      });
      mk.bindTooltip(`${name.replace(/</g, '&lt;')}<br>${units} trucks`);
      mk.on('click', () => cb.current.onSelect(dot, state));
      cluster.addLayer(mk);
    }
    layer.current = cluster.addTo(m);
  }, [points, stateStats, highlight, stateTotals]);

  return <div ref={el} className="h-[420px] md:h-[520px] w-full rounded-2xl overflow-hidden border bg-slate-100 z-0" role="region" aria-label="Map of moving companies" />;
}
