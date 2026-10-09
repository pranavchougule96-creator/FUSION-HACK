/**
 * SPACE-04: Constellation Modeling & Spacecraft Subsystems
 * Planet Labs PlanetScope & Pelican constellation generator with payload memory & radio specs.
 */

import { OrbitPropagator } from '../physics/orbit.js';

export const PRIORITY_CONFIG = {
  CRITICAL: {
    level: 'CRITICAL',
    weight: 10.0,
    color: '#ff3b69', // Bright Coral / Neon Red
    label: 'Critical Alert / Rapid Revisit',
    badgeClass: 'badge-critical'
  },
  HIGH: {
    level: 'HIGH',
    weight: 5.0,
    color: '#ffb800', // Amber
    label: 'High-Res Commercial Tasking',
    badgeClass: 'badge-high'
  },
  MEDIUM: {
    level: 'MEDIUM',
    weight: 2.5,
    color: '#00f0ff', // Cyan
    label: 'Daily Planet Monitoring',
    badgeClass: 'badge-medium'
  },
  LOW: {
    level: 'LOW',
    weight: 1.0,
    color: '#a855f7', // Violet
    label: 'Routine Telemetry & Calibration',
    badgeClass: 'badge-low'
  }
};

/**
 * Generate a synthetic constellation of Planet Labs style Earth-observation satellites.
 */
export function generateConstellation(satelliteCount = 24, priorityDistribution = null) {
  const satellites = [];

  // Walker-like / Sun-Synchronous multi-plane constellation
  // Orbital planes spaced in RAAN (e.g. 4 to 6 planes)
  const numPlanes = Math.min(6, Math.max(2, Math.floor(satelliteCount / 4)));
  const satsPerPlane = Math.ceil(satelliteCount / numPlanes);

  const priorityKeys = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  // Default distribution: 15% Critical, 30% High, 35% Medium, 20% Low
  const defaultDist = [0.15, 0.30, 0.35, 0.20];

  let satIdx = 0;
  for (let plane = 0; plane < numPlanes; plane++) {
    const raanDeg = (plane * 360) / numPlanes;

    for (let pos = 0; pos < satsPerPlane; pos++) {
      if (satIdx >= satelliteCount) break;

      const meanAnomalyDeg = (pos * 360) / satsPerPlane + (plane % 2 ? 180 / satsPerPlane : 0);

      // Determine priority
      const rand = Math.random();
      let cum = 0;
      let assignedPriority = 'MEDIUM';
      for (let p = 0; p < priorityKeys.length; p++) {
        cum += (priorityDistribution ? priorityDistribution[p] : defaultDist[p]);
        if (rand <= cum) {
          assignedPriority = priorityKeys[p];
          break;
        }
      }

      // Constellation naming: PlanetScope DOVE or PELICAN
      const isPelican = assignedPriority === 'CRITICAL' || assignedPriority === 'HIGH';
      const name = isPelican
        ? `PELICAN-${String(satIdx + 1).padStart(2, '0')}`
        : `DOVE-FL-${String(satIdx + 1).padStart(2, '0')}`;

      // Radio link specs:
      // X-Band (DOVE): 600 - 1000 Mbps
      // Ka-Band / Optical (PELICAN): 1200 - 2400 Mbps
      const baseDataRateMbps = isPelican
        ? Math.floor(1200 + Math.random() * 800)
        : Math.floor(500 + Math.random() * 500);

      // Onboard Storage: 256 GB to 1024 GB
      const bufferCapacityGB = isPelican ? 1024 : 512;
      // Initial fill state: 40% - 90% full
      const initialBufferGB = Math.round(bufferCapacityGB * (0.45 + Math.random() * 0.45));
      // Imaging generation rate (Gbps) when sunlit
      const imagingRateGbps = isPelican ? 1.8 : 0.8;

      // Keplerian elements (Sun-Synchronous orbit ~500 km)
      const altitudeKm = 480 + (satIdx % 5) * 15; // 480 - 540 km
      const semiMajorAxisKm = 6378.137 + altitudeKm;
      const inclinationDeg = 97.4 + (Math.random() - 0.5) * 0.2; // SSO

      const propagator = new OrbitPropagator({
        semiMajorAxisKm,
        eccentricity: 0.0011 + (satIdx % 3) * 0.0003,
        inclinationDeg,
        raanDeg,
        argPerigeeDeg: (satIdx * 25) % 360,
        meanAnomalyDeg: meanAnomalyDeg % 360
      });

      // Spacecraft attitude & gimbal characteristics
      const attitude = {
        rollDeg: (Math.random() - 0.5) * 4.0,   // Nadir pointing nominal ~0°
        pitchDeg: (Math.random() - 0.5) * 3.0,
        yawDeg: (Math.random() - 0.5) * 5.0,
        targetRollDeg: 0,
        targetPitchDeg: 0,
        targetYawDeg: 0,
        dishAzDeg: 0,
        dishElDeg: 45
      };

      satellites.push({
        id: `SAT-${String(satIdx + 1).padStart(2, '0')}`,
        name,
        type: isPelican ? 'Pelican Agile Earth Imager' : 'PlanetScope 3U CubeSat',
        priority: assignedPriority,
        priorityWeight: PRIORITY_CONFIG[assignedPriority].weight,
        color: PRIORITY_CONFIG[assignedPriority].color,
        propagator,
        altitudeKm,
        dataRateMbps: baseDataRateMbps,
        bufferCapacityGB,
        initialBufferGB,
        currentBufferGB: initialBufferGB,
        imagingRateGbps,
        attitude
      });

      satIdx++;
    }
  }

  return satellites;
}
