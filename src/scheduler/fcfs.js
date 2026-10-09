/**
 * SPACE-04: Baseline First-Come, First-Served (FCFS) Scheduler
 * Naive chronological greedy scheduler that accepts the first available request and drops conflicting ones.
 */

import { computeRequiredSlewTimeSec } from '../physics/slew.js';

export function runFCFSScheduler(candidatePasses, satellites, groundStations) {
  // Sort requests strictly chronologically by AOS start time
  const sortedRequests = [...candidatePasses].sort((a, b) => a.startSec - b.startSec);

  // Deep clone satellite buffer states to simulate memory consumption and drain
  const satBufferMap = new Map();
  satellites.forEach(s => {
    satBufferMap.set(s.id, {
      capacityGB: s.bufferCapacityGB,
      currentGB: s.initialBufferGB,
      initialGB: s.initialBufferGB,
      imagingRateGbps: s.imagingRateGbps,
      lastUpdateSec: 0,
      totalDownlinkedGB: 0,
      weightedDataGB: 0
    });
  });

  // Track station occupation and antenna state
  const stationStateMap = new Map();
  groundStations.forEach(gs => {
    stationStateMap.set(gs.id, {
      scheduledPasses: [],
      lastEndSec: -Infinity,
      lastLosAzDeg: 0,
      lastLosElDeg: gs.minElevationDeg,
      station: gs
    });
  });

  // Track satellite scheduled intervals to prevent simultaneous multi-station downlink
  const satScheduledIntervals = new Map();
  satellites.forEach(s => satScheduledIntervals.set(s.id, []));

  const scheduled = [];
  const rejected = [];

  for (const req of sortedRequests) {
    const stState = stationStateMap.get(req.stationId);
    const satState = satBufferMap.get(req.satId);
    const satIntervals = satScheduledIntervals.get(req.satId);

    // 1. Check satellite transmitter concurrency (cannot downlink to 2 stations at once)
    const satOverlaps = satIntervals.some(
      interval => !(req.endSec <= interval.startSec || req.startSec >= interval.endSec)
    );

    if (satOverlaps) {
      rejected.push({
        ...req,
        scheduler: 'FCFS',
        reason: 'SATELLITE_CONCURRENT_LOCK',
        conflictDetails: 'Transmitter busy with another ground station'
      });
      continue;
    }

    // 2. Check station single-dish time overlap
    const stationOverlaps = stState.scheduledPasses.some(
      p => !(req.endSec <= p.startSec || req.startSec >= p.endSec)
    );

    if (stationOverlaps) {
      rejected.push({
        ...req,
        scheduler: 'FCFS',
        reason: 'STATION_TIME_OVERLAP',
        conflictDetails: 'Dish already allocated to prior chronological request'
      });
      continue;
    }

    // 3. Check slew-rate transition constraint from previous pass at this station
    // Find the immediately preceding scheduled pass at this station
    let prevPass = null;
    for (let i = stState.scheduledPasses.length - 1; i >= 0; i--) {
      if (stState.scheduledPasses[i].endSec <= req.startSec) {
        prevPass = stState.scheduledPasses[i];
        break;
      }
    }

    if (prevPass) {
      const slewCalc = computeRequiredSlewTimeSec(
        prevPass.losAzDeg,
        prevPass.losElDeg,
        req.aosAzDeg,
        req.aosElDeg,
        stState.station.slewRateDegPerSec,
        stState.station.settlingTimeSec
      );

      const availableGapSec = req.startSec - prevPass.endSec;
      if (availableGapSec < slewCalc.totalRequiredSec) {
        rejected.push({
          ...req,
          scheduler: 'FCFS',
          reason: 'SLEW_RATE_INFEASIBLE',
          conflictDetails: `Required slew ${slewCalc.totalRequiredSec.toFixed(1)}s exceeds available gap ${availableGapSec}s (deficit: ${(slewCalc.totalRequiredSec - availableGapSec).toFixed(1)}s)`
        });
        continue;
      }
    }

    // 4. Compute satellite buffer drainage
    // Satellite generates data over time between passes
    const timeSinceLast = Math.max(0, req.startSec - satState.lastUpdateSec);
    // Rough simulation of daylight imaging data generation: 30% duty cycle
    const generatedGB = (timeSinceLast * satState.imagingRateGbps * 0.3) / 8;
    satState.currentGB = Math.min(satState.capacityGB, satState.currentGB + generatedGB);

    // Actual downlinked data cannot exceed onboard buffered payload
    const actualDownlinkGB = Math.min(satState.currentGB, req.potentialDataGB);
    satState.currentGB = Math.max(0, satState.currentGB - actualDownlinkGB);
    satState.lastUpdateSec = req.endSec;
    satState.totalDownlinkedGB += actualDownlinkGB;

    const weightedScore = actualDownlinkGB * req.priorityWeight;
    satState.weightedDataGB += weightedScore;

    const scheduledPass = {
      ...req,
      scheduler: 'FCFS',
      actualDataGB: parseFloat(actualDownlinkGB.toFixed(2)),
      weightedScore: parseFloat(weightedScore.toFixed(2)),
      bufferDrainGB: parseFloat(actualDownlinkGB.toFixed(2)),
      status: 'SCHEDULED'
    };

    scheduled.push(scheduledPass);
    stState.scheduledPasses.push(scheduledPass);
    stState.lastEndSec = req.endSec;
    stState.lastLosAzDeg = req.losAzDeg;
    stState.lastLosElDeg = req.losElDeg;

    satIntervals.push({ startSec: req.startSec, endSec: req.endSec });
  }

  // Aggregate Performance Metrics
  const totalRawDataGB = scheduled.reduce((sum, p) => sum + p.actualDataGB, 0);
  const totalWeightedScore = scheduled.reduce((sum, p) => sum + p.weightedScore, 0);
  const totalScheduledDurationSec = scheduled.reduce((sum, p) => sum + p.durationSec, 0);
  const totalHorizonStationSec = groundStations.length * 86400;
  const stationUtilizationPct = (totalScheduledDurationSec / totalHorizonStationSec) * 100;
  const conflictRatePct = (rejected.length / sortedRequests.length) * 100;

  // Breakdown by priority
  const priorityBreakdown = {
    CRITICAL: { scheduled: 0, dropped: 0, dataGB: 0 },
    HIGH: { scheduled: 0, dropped: 0, dataGB: 0 },
    MEDIUM: { scheduled: 0, dropped: 0, dataGB: 0 },
    LOW: { scheduled: 0, dropped: 0, dataGB: 0 }
  };

  scheduled.forEach(p => {
    if (priorityBreakdown[p.priority]) {
      priorityBreakdown[p.priority].scheduled++;
      priorityBreakdown[p.priority].dataGB += p.actualDataGB;
    }
  });

  rejected.forEach(p => {
    if (priorityBreakdown[p.priority]) {
      priorityBreakdown[p.priority].dropped++;
    }
  });

  return {
    algorithm: 'FCFS (First-Come, First-Served Baseline)',
    scheduled,
    rejected,
    totalRequests: sortedRequests.length,
    scheduledCount: scheduled.length,
    rejectedCount: rejected.length,
    totalRawDataGB: parseFloat(totalRawDataGB.toFixed(1)),
    totalWeightedScore: parseFloat(totalWeightedScore.toFixed(1)),
    stationUtilizationPct: parseFloat(stationUtilizationPct.toFixed(2)),
    conflictRatePct: parseFloat(conflictRatePct.toFixed(1)),
    priorityBreakdown
  };
}
