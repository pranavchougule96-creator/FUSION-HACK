/**
 * SPACE-04: Ground Station Network Database & Topocentric Geometry
 * Planet Labs & Commercial High-Latitude & Equatorial Downlink Network
 */

export const GROUND_STATIONS_DATA = [
  {
    id: 'GS-SVB',
    name: 'Svalbard Ground Station',
    location: 'Spitsbergen, Norway',
    lat: 78.2298,
    lon: 15.4078,
    altKm: 0.45,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 3.5,
    settlingTimeSec: 12.0,
    color: '#00f0ff', // Cyan
    description: 'High-latitude Arctic station. High revisit rate (~14 passes/day per SSO satellite).'
  },
  {
    id: 'GS-INU',
    name: 'Inuvik Satellite Station',
    location: 'Northwest Territories, Canada',
    lat: 68.3607,
    lon: -133.7230,
    altKm: 0.10,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 3.0,
    settlingTimeSec: 15.0,
    color: '#00ff9d', // Emerald
    description: 'Polar North America multi-mission tracking and high-volume downlink facility.'
  },
  {
    id: 'GS-PUQ',
    name: 'Punta Arenas Station',
    location: 'Patagonia, Chile',
    lat: -53.1638,
    lon: -70.9171,
    altKm: 0.04,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 4.0,
    settlingTimeSec: 10.0,
    color: '#ffb800', // Amber
    description: 'Sub-polar South America gateway. Critical for southern hemisphere pass reception.'
  },
  {
    id: 'GS-TRL',
    name: 'Troll Satellite Station',
    location: 'Queen Maud Land, Antarctica',
    lat: -72.0114,
    lon: 2.5350,
    altKm: 1.28,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 3.0,
    settlingTimeSec: 15.0,
    color: '#a855f7', // Violet
    description: 'Deep Antarctic polar terminal providing near-continuous southern pass coverage.'
  },
  {
    id: 'GS-HBK',
    name: 'Hartebeesthoek Station',
    location: 'Gauteng, South Africa',
    lat: -25.8872,
    lon: 27.7072,
    altKm: 1.41,
    minElevationDeg: 12.0,
    slewRateDegPerSec: 5.0,
    settlingTimeSec: 10.0,
    color: '#38bdf8', // Sky
    description: 'Mid-latitude African downlink facility for rapid low-latency imagery dump.'
  },
  {
    id: 'GS-HAW',
    name: 'South Point Station',
    location: 'Hawaii, USA',
    lat: 18.9136,
    lon: -155.6811,
    altKm: 0.05,
    minElevationDeg: 12.0,
    slewRateDegPerSec: 4.5,
    settlingTimeSec: 12.0,
    color: '#f43f5e', // Rose
    description: 'Mid-Pacific tracking station providing crucial coverage over oceanic passes.'
  },
  {
    id: 'GS-SGP',
    name: 'Singapore Ground Terminal',
    location: 'Jurong, Singapore',
    lat: 1.3521,
    lon: 103.8198,
    altKm: 0.03,
    minElevationDeg: 12.0,
    slewRateDegPerSec: 6.0,
    settlingTimeSec: 8.0,
    color: '#ec4899', // Pink
    description: 'Equatorial node for high-priority tropical zone optical imagery downlinks.'
  },
  {
    id: 'GS-FBK',
    name: 'Fairbanks Command & Data',
    location: 'Alaska, USA',
    lat: 64.8378,
    lon: -147.7164,
    altKm: 0.15,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 3.5,
    settlingTimeSec: 12.0,
    color: '#22d3ee', // Cyan-teal
    description: 'Sub-arctic station offering frequent high-inclination visibility passes.'
  },
  {
    id: 'GS-BLR',
    name: 'Bengaluru Ground Station',
    location: 'Karnataka, India (ISRO ISTRAC Hub)',
    lat: 12.9716,
    lon: 77.5946,
    altKm: 0.92,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 4.5,
    settlingTimeSec: 12.0,
    color: '#ff9933', // Saffron / Orange
    description: 'Primary Indian deep space & LEO telemetry tracking network hub (ISTRAC Bengaluru).'
  },
  {
    id: 'GS-LKO',
    name: 'Lucknow Telemetry Station',
    location: 'Uttar Pradesh, India (ISRO)',
    lat: 26.8467,
    lon: 80.9462,
    altKm: 0.12,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 4.0,
    settlingTimeSec: 12.0,
    color: '#10b981', // Emerald / Green
    description: 'Northern Indian tracking terminal providing vital mid-latitude sub-satellite pass coverage.'
  },
  {
    id: 'GS-IXZ',
    name: 'Port Blair Ground Gateway',
    location: 'Andaman & Nicobar Islands, India',
    lat: 11.6234,
    lon: 92.7265,
    altKm: 0.02,
    minElevationDeg: 10.0,
    slewRateDegPerSec: 5.0,
    settlingTimeSec: 10.0,
    color: '#00f0ff', // Cyan
    description: 'Strategic Indian Ocean and Bay of Bengal maritime satellite downlink gateway.'
  }
];

export const EARTH_RADIUS_KM = 6378.137;

/**
 * Convert Geodetic (Lat, Lon, AltKm) to Earth-Centered Earth-Fixed (ECEF) coordinates.
 */
export function geodeticToECEF(latDeg, lonDeg, altKm = 0) {
  const phi = (latDeg * Math.PI) / 180;
  const lambda = (lonDeg * Math.PI) / 180;
  
  // WGS-84 parameters
  const a = EARTH_RADIUS_KM;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  
  const x = (N + altKm) * Math.cos(phi) * Math.cos(lambda);
  const y = (N + altKm) * Math.cos(phi) * Math.sin(lambda);
  const z = (N * (1 - e2) + altKm) * Math.sin(phi);
  
  return [x, y, z];
}

/**
 * Compute local topocentric coordinates (Azimuth, Elevation, Range) from Ground Station to Target.
 * Returns { azDeg, elDeg, rangeKm }
 */
export function computeTopocentric(stationLatDeg, stationLonDeg, stationAltKm, satECEF) {
  const gsECEF = geodeticToECEF(stationLatDeg, stationLonDeg, stationAltKm);
  const dx = satECEF[0] - gsECEF[0];
  const dy = satECEF[1] - gsECEF[1];
  const dz = satECEF[2] - gsECEF[2];
  
  const phi = (stationLatDeg * Math.PI) / 180;
  const lambda = (stationLonDeg * Math.PI) / 180;
  
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lambda);
  const cosLam = Math.cos(lambda);
  
  // ECEF to local SEZ/ENU frame
  // East: -sinLam*dx + cosLam*dy
  // North: -sinPhi*cosLam*dx - sinPhi*sinLam*dy + cosPhi*dz
  // Up: cosPhi*cosLam*dx + cosPhi*sinLam*dy + sinPhi*dz
  const east = -sinLam * dx + cosLam * dy;
  const north = -sinPhi * cosLam * dx - sinPhi * sinLam * dy + cosPhi * dz;
  const up = cosPhi * cosLam * dx + cosPhi * sinLam * dy + sinPhi * dz;
  
  const rangeKm = Math.sqrt(east * east + north * north + up * up);
  const elRad = Math.asin(Math.max(-1, Math.min(1, up / rangeKm)));
  let azRad = Math.atan2(east, north);
  if (azRad < 0) azRad += 2 * Math.PI;
  
  return {
    azDeg: (azRad * 180) / Math.PI,
    elDeg: (elRad * 180) / Math.PI,
    rangeKm,
    unitVectorTopocentric: [east / rangeKm, north / rangeKm, up / rangeKm]
  };
}
