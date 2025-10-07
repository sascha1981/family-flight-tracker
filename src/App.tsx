import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime, Interval } from 'luxon'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet'
import './index.css'

// Fix leaflet marker assets
// @ts-ignore
delete (L as any).Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Airport = { iata: string; name: string; lat: number; lon: number; tz: string }
type Segment = { id: string; label: string; flight: string; from: Airport; to: Airport; depLocal: string; arrLocal: string }
type WeatherBrief = { tempC?: number; windKph?: number; time?: string }
type LiveStatus = { status?: string; gateDep?: string; gateArr?: string; eta?: string; position?: {lat:number; lon:number} | null }

const AIRPORTS: Record<string, Airport> = {
  DRS: { iata: 'DRS', name: 'Dresden', lat: 51.1343, lon: 13.7671, tz: 'Europe/Berlin' },
  FRA: { iata: 'FRA', name: 'Frankfurt/Main', lat: 50.0379, lon: 8.5622, tz: 'Europe/Berlin' },
  EWR: { iata: 'EWR', name: 'Newark Liberty', lat: 40.6895, lon: -74.1745, tz: 'America/New_York' },
}

const SEGMENTS: Segment[] = [
  { id:'out1', label:'Hinflug 1', flight:'UA 9001', from: AIRPORTS.DRS, to: AIRPORTS.FRA, depLocal:'2025-10-11T10:45', arrLocal:'2025-10-11T11:50' },
  { id:'out2', label:'Hinflug 2', flight:'UA 8839', from: AIRPORTS.FRA, to: AIRPORTS.EWR, depLocal:'2025-10-11T13:20', arrLocal:'2025-10-11T21:40' },
  { id:'ret1', label:'Rückflug 1', flight:'UA 8838', from: AIRPORTS.EWR, to: AIRPORTS.FRA, depLocal:'2025-10-18T18:00', arrLocal:'2025-10-19T07:30' },
  { id:'ret2', label:'Rückflug 2', flight:'UA 9050', from: AIRPORTS.FRA, to: AIRPORTS.DRS, depLocal:'2025-10-19T09:15', arrLocal:'2025-10-19T10:15' },
]

function useInterval(cb:()=>void, delay:number|null){ const r=useRef(cb); useEffect(()=>{r.current=cb},[cb]); useEffect(()=>{ if(delay==null) return; const id=setInterval(()=>r.current(),delay); return ()=>clearInterval(id)},[delay]) }
function fmt(dt: DateTime, f='EEE dd.LL.yyyy HH:mm'){ return dt.toFormat(f) }
const isClient = typeof window !== 'undefined';

async function fetchWeather(lat:number, lon:number, tz:string): Promise<WeatherBrief> {
  try {
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    u.searchParams.set('latitude', String(lat));
    u.searchParams.set('longitude', String(lon));
    u.searchParams.set('current_weather', 'true');
    u.searchParams.set('timezone', tz);
    const r = await fetch(u.toString());
    const j = await r.json();
    return { tempC: j?.current_weather?.temperature, windKph: j?.current_weather?.windspeed, time: j?.current_weather?.time };
  } catch { return {} }
}

async function fetchOpenSkyBBox(lamin:number, lomin:number, lamax:number, lomax:number){
  const u = new URL('/.netlify/functions/opensky', window.location.origin);
  u.searchParams.set('lamin', String(lamin)); u.searchParams.set('lomin', String(lomin));
  u.searchParams.set('lamax', String(lamax)); u.searchParams.set('lomax', String(lomax));
  const r = await fetch(u.toString()); if(!r.ok) throw new Error('opensky'); return r.json();
}

function FitToAirports({ from, to }: {from:Airport; to:Airport}){
  const map = useMap();
  useEffect(()=>{ const b = L.latLngBounds([from.lat,from.lon] as any, [to.lat,to.lon] as any); map.fitBounds(b.pad(0.3)); },[from,to,map]);
  return null;
}

function Badge({children}:{children:React.ReactNode}){ return <span className="px-2 py-1 rounded-full text-xs bg-gray-100">{children}</span> }
function Card({children}:{children:React.ReactNode}){ return <div className="rounded-2xl shadow bg-white">{children}</div> }
function CardContent({children, className}:{children:React.ReactNode; className?:string}){ return <div className={"p-5 "+(className||"")}>{children}</div> }
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'default'|'outline'|'secondary'}){
  const base='px-3 py-2 rounded-xl text-sm font-medium shadow-sm';
  const v = props.variant==='outline'?'border border-gray-300 bg-white':props.variant==='secondary'?'bg-gray-100':'bg-black text-white';
  const {children, variant, className, ...rest}=props;
  return <button className={base+' '+v+' '+(className||'')} {...rest}>{children}</button>
}

function useShare(title:string){ return async ()=>{ const url=window.location.href; try{ if(navigator.share) await navigator.share({title,url}); else{ await navigator.clipboard.writeText(url); alert('Link kopiert.'); } }catch{} } }

// NEW: fully working countdown card
function CountdownCard({ targetISO, tz }: { targetISO: string; tz: string }) {
  const target = useMemo(() => DateTime.fromISO(targetISO, { zone: tz }), [targetISO, tz]);
  const [now, setNow] = useState(DateTime.now().setZone(tz));
  useInterval(() => setNow(DateTime.now().setZone(tz)), 1000);

  const diff = target.diff(now, ['days', 'hours', 'minutes', 'seconds']).toObject();
  const isPast = now > target;

  const cell = (v?: number, label?: string) => (
    <div style={{minWidth:70, textAlign:'center'}}>
      <div style={{fontSize:'2rem', fontWeight:700}}>{Math.max(0, Math.floor(v ?? 0))}</div>
      <div style={{fontSize:12, color:'#6b7280'}}>{label}</div>
    </div>
  );

  return (
    <Card>
      <CardContent>
        <div className="text-sm font-medium mb-2">Countdown bis zum Abflug (DRS 11.10., 10:45)</div>
        <div className="text-xs text-gray-500 mb-3">Zeitbasis: {tz}</div>
        {isPast ? (
          <div className="text-lg font-semibold">Viel Spaß! 🎉</div>
        ) : (
          <div className="flex items-center gap-4">
            {cell(diff.days, 'Tage')}
            <div className="text-2xl">:</div>
            {cell(diff.hours, 'Stunden')}
            <div className="text-2xl">:</div>
            {cell(diff.minutes, 'Minuten')}
            <div className="text-2xl">:</div>
            {cell(diff.seconds, 'Sekunden')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExportICSButton(){
  const onClick=()=>{
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Family Flight Tracker//DE'];
    for(const s of SEGMENTS){
      const dep=DateTime.fromISO(s.depLocal,{zone:s.from.tz}).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
      const arr=DateTime.fromISO(s.arrLocal,{zone:s.to.tz}).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${s.id}@family-flight-tracker`);
      lines.push(`DTSTAMP:${DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
      lines.push(`DTSTART:${dep}`); lines.push(`DTEND:${arr}`);
      lines.push(`SUMMARY:${s.flight} ${s.from.iata}->${s.to.iata}`);
      lines.push(`LOCATION:${s.from.name} (${s.from.iata})->${s.to.name} (${s.to.iata})`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob=new Blob([lines.join('\\r\\n')],{type:'text/calendar'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='fluege.ics'; a.click();
  };
  return <Button variant="secondary" onClick={onClick}>Alle Flüge als .ics</Button>
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }){
  return <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
    <div className="text-xs text-gray-500">{label}</div><div className="font-medium text-sm">{value}</div>
  </div>
}

function WeatherRow({ airport, brief }: { airport: Airport; brief: WeatherBrief }){
  return <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
    <div className="text-sm font-medium">Wetter · {airport.iata} ({airport.name})</div>
    <div className="ml-auto text-sm text-gray-600">
      {brief.tempC != null ? `${Math.round(brief.tempC)}°C` : '–'} {' '}
      {brief.windKph != null ? `${Math.round(brief.windKph)} km/h` : '–'}
    </div>
    <div className="text-xs text-gray-400">{brief.time ? DateTime.fromISO(brief.time).toFormat('HH:mm') : ''}</div>
  </div>
}

function FitTimes({ dep, arr }:{dep:DateTime; arr:DateTime}){
  return <div className="text-xs text-gray-500 mt-1">
    DE: {dep.setZone('Europe/Berlin').toFormat('HH:mm')} · US East: {arr.setZone('America/New_York').toFormat('HH:mm')}
  </div>
}

function FlightCard({ seg, useOpenSky }: { seg: Segment; useOpenSky: boolean }){
  const dep=DateTime.fromISO(seg.depLocal,{zone:seg.from.tz});
  const arr=DateTime.fromISO(seg.arrLocal,{zone:seg.to.tz});
  const [status,setStatus]=useState<LiveStatus>({});
  const [wxDep,setWxDep]=useState<WeatherBrief>({});
  const [wxArr,setWxArr]=useState<WeatherBrief>({});
  const [osPos,setOsPos]=useState<{lat:number; lon:number}|null>(null);

  useEffect(()=>{ fetchWeather(seg.from.lat,seg.from.lon,seg.from.tz).then(setWxDep); fetchWeather(seg.to.lat,seg.to.lon,seg.to.tz).then(setWxArr); },[seg.from,seg.to]);

  useInterval(()=>{
    if(!useOpenSky || !isClient) return;
    const nowUtc=DateTime.now().toUTC(); const depUtc=dep.toUTC(); const arrUtc=arr.toUTC();
    if(!Interval.fromDateTimes(depUtc.minus({hours:2}),arrUtc.plus({hours:2})).contains(nowUtc)){ setOsPos(null); return; }
    const latMid=(seg.from.lat+seg.to.lat)/2; const lonMid=(seg.from.lon+seg.to.lon)/2; const span=8;
    fetchOpenSkyBBox(latMid-span,lonMid-span,latMid+span,lonMid+span).then(j=>{
      const states=j?.states||[]; const num=seg.flight.replace(/\D+/g,''); 
      const cs=states.filter((s:any)=>(s[1]||'').toUpperCase().includes(num));
      if(cs.length){ const s=cs[0]; setOsPos({lat:s[6],lon:s[5]}); setStatus(p=>({...p,status:p.status||'In Air (OpenSky)'})); }
    }).catch(()=>{});
  },15000);

  const inAir=()=>{ const now=DateTime.now().setZone(seg.from.tz); return Interval.fromDateTimes(dep.toUTC(),arr.toUTC()).contains(now.toUTC()); };

  return <div className="rounded-2xl shadow bg-white"><div className="p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><div className="text-xs text-gray-500">{seg.label}</div><div className="text-xl font-semibold">{seg.flight} · {seg.from.iata} → {seg.to.iata}</div></div>
      <div className="text-right text-sm">
        <div>{fmt(dep,'EEE dd.LL HH:mm')} ({seg.from.tz})</div>
        <div>→ {fmt(arr,'EEE dd.LL HH:mm')} ({seg.to.tz})</div>
        <FitTimes dep={dep} arr={arr} />
      </div>
    </div>

    <div className="grid md:grid-cols-4 grid-cols-2 gap-3">
      <InfoRow label="Status" value={status.status ?? (inAir() ? 'Vermutlich in der Luft' : (DateTime.now() < dep ? 'Geplant' : 'Vermutlich gelandet'))} />
      <InfoRow label="Gate (ab)" value={status.gateDep ?? '–'} />
      <InfoRow label="Gate (an)" value={status.gateArr ?? '–'} />
      <InfoRow label="ETA" value={status.eta ? fmt(DateTime.fromISO(status.eta),'dd.LL HH:mm') : '–'} />
    </div>

    <div className="grid md:grid-cols-2 gap-3">
      <WeatherRow airport={seg.from} brief={wxDep} />
      <WeatherRow airport={seg.to} brief={wxArr} />
    </div>

    {isClient && (
      <div className="h-[320px] rounded-xl overflow-hidden">
        <MapContainer className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitToAirports from={seg.from} to={seg.to} />
          <Marker position={[seg.from.lat,seg.from.lon]} />
          <Marker position={[seg.to.lat,seg.to.lon]} />
          <Polyline positions={[[seg.from.lat,seg.from.lon],[seg.to.lat,seg.to.lon]] as any} />
          {(status.position || osPos) && <CircleMarker center={[status.position?.lat ?? osPos!.lat, status.position?.lon ?? osPos!.lon]} radius={6} />}
        </MapContainer>
      </div>
    )}

    <div className="text-xs text-gray-500">Quellen: Open-Meteo (Wetter), OpenSky (Positionssuche), optional AeroDataBox.</div>
  </div></div>
}

export default function App(){
  const share=useShare('Onkel Sascha zu Besuch bei Alex & Sam 2025');
  const first=SEGMENTS[0];
  const [useOpenSky,setUseOpenSky]=useState(true);

  return <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">🧑‍✈️ Onkel Sascha zu Besuch bei Alex & Sam 2025</h1>
        <div className="text-gray-600">11.–19. Oktober 2025 · DRS ⇄ EWR (via FRA) · Familie: Stephanie, Alex, Mutti, Vati</div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <Badge>DE: Europe/Berlin</Badge><Badge>US: America/New_York</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={share}>Teilen</Button>
        <ExportICSButton />
      </div>
    </header>

    {/* LIVE COUNTDOWN */}
    <CountdownCard targetISO={first.depLocal} tz={first.from.tz} />

    <div className="space-y-4">
      <FlightCard seg={SEGMENTS[0]} useOpenSky={useOpenSky} />
      <FlightCard seg={SEGMENTS[1]} useOpenSky={useOpenSky} />
      <FlightCard seg={SEGMENTS[2]} useOpenSky={useOpenSky} />
      <FlightCard seg={SEGMENTS[3]} useOpenSky={useOpenSky} />
    </div>
  </div>
}
