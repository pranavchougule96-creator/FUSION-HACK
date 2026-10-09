/**
 * Generate passes.csv and passes.json with Indian ground stations (Bengaluru, Lucknow, Port Blair)
 * and real Planet Labs constellation profiles.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GROUND_STATIONS_DATA } from '../src/physics/groundStations.js';
import { generateConstellation } from '../src/scheduler/constellation.js';
import { detectPasses } from '../src/scheduler/passDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Filter stations to include Indian stations + polar stations
const stations = GROUND_STATIONS_DATA.filter(s => 
  ['GS-BLR', 'GS-LKO', 'GS-IXZ', 'GS-SVB', 'GS-INU'].includes(s.id)
);

const satellites = generateConstellation(24);
const passes = detectPasses(satellites, stations, 86400, 30);

// Convert to CSV
const csvRows = [
  'request_id,satellite_name,satellite_type,station_id,station_name,aos_utc_sec,los_utc_sec,duration_sec,peak_elevation_deg,priority,priority_weight,data_rate_mbps,potential_data_gb'
];

passes.forEach(p => {
  csvRows.push([
    p.id,
    `"${p.satName}"`,
    `"${p.satType}"`,
    p.stationId,
    `"${p.stationName}"`,
    p.startSec,
    p.endSec,
    p.durationSec,
    p.peakElDeg,
    p.priority,
    p.priorityWeight,
    p.dataRateMbps,
    p.potentialDataGB
  ].join(','));
});

const csvContent = csvRows.join('\n');

// Write to data/passes.csv and public/data/passes.csv
const dataDir = path.join(rootDir, 'data');
const publicDataDir = path.join(rootDir, 'public', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'passes.csv'), csvContent, 'utf-8');
fs.writeFileSync(path.join(publicDataDir, 'passes.csv'), csvContent, 'utf-8');

fs.writeFileSync(path.join(dataDir, 'passes.json'), JSON.stringify(passes, null, 2), 'utf-8');
fs.writeFileSync(path.join(publicDataDir, 'passes.json'), JSON.stringify(passes, null, 2), 'utf-8');

console.log(`✅ Successfully generated ${passes.length} passes across Indian stations (Bengaluru, Lucknow, Port Blair) & polar network!`);
console.log(`   Saved to: data/passes.csv and public/data/passes.csv`);
