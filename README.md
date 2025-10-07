# Family Flight Tracker (Netlify Ready)

Einfaches React/TypeScript-Projekt (Vite) für deine Familien-Reise:
- Countdown bis 11.10.2025 (DRS 10:45 Europe/Berlin)
- 4 Segmente (UA 9001, 8839, 8838, 9050)
- Wetter (Open-Meteo)
- Karten (Leaflet) und Live-Position über OpenSky **via Netlify Function (JavaScript)** (keine Registrierung)
- .ics-Export für alle Flüge

## Lokale Entwicklung
```bash
npm install
npm run dev
```
Öffne http://localhost:5173

## Netlify Deploy
1. Repo auf GitHub/GitLab anlegen und pushen **oder** Netlify CLI nutzen.
2. Netlify: *Add new site* → *Import from Git*.
3. Build command: `npm run build`, Publish dir: `dist`
4. Funktionen sind unter `/.netlify/functions/opensky` verfügbar.

> Optional: weitere Proxy-Funktionen (z. B. AeroDataBox) hinzufügen.


## Optional: AeroDataBox (Gates/ETA)
- In Netlify unter *Site settings → Environment variables* die Variable `AERODATABOX_KEY` setzen (RapidAPI Key).
- Die App ruft dann `/.netlify/functions/aerodatabox` auf und zeigt genauere Status/Gate/ETA.
