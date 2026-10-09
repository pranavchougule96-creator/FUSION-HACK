/**
 * SPACE-04: Ground Station Pass Detection & Contact Geometry
 * Computes AOS, LOS, peak elevation, and contact opportunities over the scheduling horizon.
 */

import { computeTopocentric } from '../physics/groundStations.js';

/**
 * Detect all contact windows between constellation satellites and ground stations.
 *
 * @param {Array} satellites Constellation satellites
 * @param {Array} groundStations Active ground stations
 * @param {number} horizonSec Total planning duration (e.g., 86400 = 24h)
 * @param {number} stepSec Search discretization step in seconds (e.g., 30s)
 */
export function detectPasses(satellites, groundStations, horizonSec = 86400, stepSec = 30) {
  const allPasses = [];
  let passCounter = 1;

  for (const station of groundStations) {
    const minEl = station.minElevationDeg;

    for (const sat of satellites) {
      let inPass = false;
      let aosSec = 0;
      let aosTopo = null;
      let peakEl = 0;
      let lastTopo = null;
      let lastSampleSec = 0;

      for (let t = 0; t <= horizonSec; t += stepSec) {
        const satState = sat.propagator.propagate(t);
        const topo = computeTopocentric(
          station.lat,
          station.lon,
          station.altKm,
          satState.ecefPos
        );

        if (topo.elDeg >= minEl) {
          if (!inPass) {
            // AOS detected
            inPass = true;
            // Linear interpolation for more accurate AOS timestamp
            let preciseAos = t;
            if (lastTopo && t > 0) {
              const fraction = (minEl - lastTopo.elDeg) / (topo.elDeg - lastTopo.elDeg);
              preciseAos = lastSampleSec + fraction * stepSec;
            }
            aosSec = Math.round(preciseAos);
            aosTopo = topo;
            peakEl = topo.elDeg;
          } else {
            if (topo.elDeg > peakEl) {
              peakEl = topo.elDeg;
            }
          }
        } else {
          if (inPass) {
            // LOS detected
            inPass = false;
            let preciseLos = t;
            if (lastTopo) {
              const fraction = (minEl - lastTopo.elDeg) / (topo.elDeg - lastTopo.elDeg);
              preciseLos = lastSampleSec + fraction * stepSec;
            }
            const losSec = Math.round(preciseLos);
            const durationSec = Math.max(30, losSec - aosSec);

            // Potential raw data transfer in Gigabytes (Gb = 1000 Mb, GB = 8 Gb)
            // Higher elevation contacts achieve better SNR/MCS modcod, increasing data rate
            const elevationBoost = 1.0 + Math.min(0.5, (peakEl - minEl) / 90.0);
            const effectiveDataRateMbps = Math.round(sat.dataRateMbps * elevationBoost);
            const potentialDataGB = (effectiveDataRateMbps * durationSec) / 8000;

            allPasses.push({
              id: `REQ-${String(passCounter++).padStart(3, '0')}`,
              satId: sat.id,
              satName: sat.name,
              satType: sat.type,
              priority: sat.priority,
              priorityWeight: sat.priorityWeight,
              color: sat.color,
              stationId: station.id,
              stationName: station.name,
              stationColor: station.color,
              startSec: aosSec,
              endSec: losSec,
              durationSec,
              peakElDeg: parseFloat(peakEl.toFixed(1)),
              aosAzDeg: parseFloat(aosTopo.azDeg.toFixed(1)),
              aosElDeg: parseFloat(Math.max(minEl, aosTopo.elDeg).toFixed(1)),
              losAzDeg: parseFloat(lastTopo.azDeg.toFixed(1)),
              losElDeg: parseFloat(Math.max(minEl, lastTopo.elDeg).toFixed(1)),
              dataRateMbps: effectiveDataRateMbps,
              potentialDataGB: parseFloat(potentialDataGB.toFixed(2)),
              satellite: sat,
              groundStation: station
            });
          }
        }

        lastTopo = topo;
        lastSampleSec = t;
      }

      // Handle pass still active at horizon boundary
      if (inPass) {
        const losSec = horizonSec;
        const durationSec = losSec - aosSec;
        if (durationSec > 30) {
          const effectiveDataRateMbps = sat.dataRateMbps;
          const potentialDataGB = (effectiveDataRateMbps * durationSec) / 8000;
          allPasses.push({
            id: `REQ-${String(passCounter++).padStart(3, '0')}`,
            satId: sat.id,
            satName: sat.name,
            satType: sat.type,
            priority: sat.priority,
            priorityWeight: sat.priorityWeight,
            color: sat.color,
            stationId: station.id,
            stationName: station.name,
            stationColor: station.color,
            startSec: aosSec,
            endSec: losSec,
            durationSec,
            peakElDeg: parseFloat(peakEl.toFixed(1)),
            aosAzDeg: parseFloat(aosTopo.azDeg.toFixed(1)),
            aosElDeg: parseFloat(Math.max(minEl, aosTopo.elDeg).toFixed(1)),
            losAzDeg: parseFloat(lastTopo.azDeg.toFixed(1)),
            losElDeg: parseFloat(Math.max(minEl, lastTopo.elDeg).toFixed(1)),
            dataRateMbps: effectiveDataRateMbps,
            potentialDataGB: parseFloat(potentialDataGB.toFixed(2)),
            satellite: sat,
            groundStation: station
          });
        }
      }
    }
  }

  // Sort candidate passes by start time
  allPasses.sort((a, b) => a.startSec - b.startSec);
  return allPasses;
}
