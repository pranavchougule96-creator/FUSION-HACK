/**
 * SPACE-04: Autonomous Ground Station Scheduling for Multi-Satellite Downlink
 * Main Application Orchestrator
 */

import './style.css';
import confetti from 'canvas-confetti';
import { GROUND_STATIONS_DATA } from './physics/groundStations.js';
import { generateConstellation } from './scheduler/constellation.js';
import { detectPasses } from './scheduler/passDetector.js';
import { runFCFSScheduler } from './scheduler/fcfs.js';
import { AutonomousGroundStationOptimizer } from './scheduler/optimizer.js';

import { ConstellationGlobe3D } from './ui/globe3d.js';
import { SatelliteAttitudeMonitor } from './ui/attitudeMonitor.js';
import { MultiTrackGanttChart } from './ui/ganttChart.js';
import { AnalyticsHud } from './ui/analyticsHud.js';
import { ScenarioControlPanel } from './ui/controls.js';

class MissionControlDashboard {
  constructor() {
    this.appContainer = document.getElementById('app');

    // Simulation Clock State
    this.simEpochSec = 0;
    this.horizonSec = 86400; // 24 hours
    this.isPlaying = true;
    this.timeSpeed = 60; // 60x speed default
    this.lastFrameTimestamp = performance.now();

    // Data State
    this.satellites = [];
    this.activeGroundStations = [];
    this.candidatePasses = [];
    this.fcfsResult = null;
    this.optimizedResult = null;
    this.selectedSatellite = null;

    // Component References
    this.globe3D = null;
    this.attitudeMonitor = null;
    this.ganttChart = null;
    this.analyticsHud = null;
    this.controlPanel = null;

    this.optimizerEngine = new AutonomousGroundStationOptimizer({
      maxIterations: 1800,
      tabuTenure: 25
    });

    this.init();
  }

  init() {
    this.buildLayout();
    this.initComponents();
    this.runFullScenario({
      satelliteCount: 24,
      selectedStationIds: ['GS-SVB', 'GS-INU', 'GS-PUQ', 'GS-TRL', 'GS-HBK'],
      slewRateDegPerSec: 3.5,
      settlingTimeSec: 15.0,
      minElevationDeg: 10.0,
      criticalWeight: 10.0,
      highWeight: 5.0
    });

    // Start simulation animation loop
    this.simLoop = this.simLoop.bind(this);
    requestAnimationFrame(this.simLoop);
  }

  buildLayout() {
    this.appContainer.innerHTML = `
      <!-- Top Mission Control Navigation Bar -->
      <header class="mission-header">
        <div class="brand-section">
          <div class="brand-logo-icon">🛰️</div>
          <div class="brand-titles">
            <h1 class="brand-title">
              SPACE-04: AUTONOMOUS GROUND STATION SCHEDULER
            </h1>
            <span class="brand-sub">PLANET LABS MULTI-SATELLITE DOWNLINK OPTIMIZATION DASHBOARD</span>
          </div>
        </div>

        <div class="header-status-ticker">
          <div class="status-pill">
            <span class="led-pulse"></span>
            <span class="font-mono text-emerald" id="system-status-indicator">SYSTEM: OPTIMIZED</span>
          </div>
          <div class="header-time-pill" id="header-utc-clock">00:00:00 UTC</div>
        </div>
      </header>

      <!-- Main Dashboard Grid -->
      <main class="dashboard-cockpit">
        <!-- Cockpit Upper Row: 3D Constellation Map + Attitude & Slew Monitor -->
        <section class="cockpit-upper-row">
          <!-- Panel 1: 3D Constellation & Ground Network Map -->
          <div class="panel-section" id="panel-globe">
            <div class="panel-header">
              <div class="panel-title-wrapper">
                <span class="panel-icon">🌐</span>
                <h2 class="panel-title">3D CONSTELLATION & GROUND NETWORK MAP</h2>
              </div>
              <div class="font-mono text-dim text-sm" id="globe-sat-counter">24 SATS | 5 STATIONS</div>
            </div>
            <div class="globe-viewport-container" id="globe-container">
              <div class="globe-hud-overlay">
                <div>ORBIT: SUN-SYNCHRONOUS LEO (~500 KM)</div>
                <div>CLICK SATELLITE TO TELEMETER ATTITUDE</div>
              </div>
              <div class="globe-camera-controls-floating">
                <button class="cam-btn" id="btn-cam-global">Global</button>
                <button class="cam-btn" id="btn-cam-arctic">Arctic (Svalbard)</button>
                <button class="cam-btn" id="btn-cam-antarctic">Antarctic (Troll)</button>
              </div>
            </div>
          </div>

          <!-- Panel 2: Satellite Attitude & Antenna Slew Monitor -->
          <div class="panel-section" id="panel-attitude"></div>
        </section>

        <!-- Panel 3: Multi-Track Timetable / Gantt Chart -->
        <section class="panel-section" id="panel-gantt"></section>

        <!-- Panel 4: Analytics HUD & Performance Comparison -->
        <section class="panel-section" id="panel-analytics"></section>

        <!-- Panel 5: Scenario Control Panel -->
        <section class="panel-section" id="panel-controls"></section>
      </main>
    `;

    // Header camera shortcut buttons
    document.getElementById('btn-cam-global').addEventListener('click', () => {
      if (this.globe3D) this.globe3D.setCameraPreset('GLOBAL');
    });
    document.getElementById('btn-cam-arctic').addEventListener('click', () => {
      if (this.globe3D) this.globe3D.setCameraPreset('NORTH_POLAR');
    });
    document.getElementById('btn-cam-antarctic').addEventListener('click', () => {
      if (this.globe3D) this.globe3D.setCameraPreset('SOUTH_POLAR');
    });
  }

  initComponents() {
    // 1. Globe 3D
    const globeContainer = document.getElementById('globe-container');
    this.globe3D = new ConstellationGlobe3D(globeContainer, (selectedSat) => {
      this.onSatelliteSelected(selectedSat);
    });

    // 2. Attitude Monitor
    const attContainer = document.getElementById('panel-attitude');
    this.attitudeMonitor = new SatelliteAttitudeMonitor(attContainer);

    // 3. Gantt Chart
    const ganttContainer = document.getElementById('panel-gantt');
    this.ganttChart = new MultiTrackGanttChart(
      ganttContainer,
      (seekSec) => this.seekToTime(seekSec),
      (clickedPass) => this.onPassClicked(clickedPass)
    );

    // 4. Analytics HUD
    const hudContainer = document.getElementById('panel-analytics');
    this.analyticsHud = new AnalyticsHud(hudContainer, (selectedSat) => {
      this.onSatelliteSelected(selectedSat);
    });

    // 5. Control Panel
    const ctrlContainer = document.getElementById('panel-controls');
    this.controlPanel = new ScenarioControlPanel(ctrlContainer, {
      onReoptimize: (cfg) => this.runFullScenario(cfg),
      onTimeChange: (sec) => this.seekToTime(sec),
      onPlayToggle: (playing) => { this.isPlaying = playing; },
      onSpeedChange: (speed) => { this.timeSpeed = speed; },
      onCameraPreset: (preset) => { if (this.globe3D) this.globe3D.setCameraPreset(preset); },
      onExport: () => this.exportScheduleJSON()
    });
    this.controlPanel.setGroundStations(GROUND_STATIONS_DATA);
  }

  /**
   * Run the complete orbital propagation, pass detection, FCFS baseline,
   * and Autonomous Slew-Constrained Optimizer pipeline.
   */
  runFullScenario(config) {
    // 1. Build Ground Stations Network
    this.activeGroundStations = GROUND_STATIONS_DATA
      .filter(gs => config.selectedStationIds.includes(gs.id))
      .map(gs => ({
        ...gs,
        slewRateDegPerSec: config.slewRateDegPerSec || gs.slewRateDegPerSec,
        settlingTimeSec: config.settlingTimeSec || gs.settlingTimeSec,
        minElevationDeg: config.minElevationDeg || gs.minElevationDeg
      }));

    if (this.activeGroundStations.length === 0) {
      this.activeGroundStations = [GROUND_STATIONS_DATA[0]];
    }

    // 2. Generate Constellation
    this.satellites = generateConstellation(config.satelliteCount || 24);

    // Apply priority multipliers
    if (config.criticalWeight || config.highWeight) {
      this.satellites.forEach(s => {
        if (s.priority === 'CRITICAL' && config.criticalWeight) {
          s.priorityWeight = config.criticalWeight;
        } else if (s.priority === 'HIGH' && config.highWeight) {
          s.priorityWeight = config.highWeight;
        }
      });
    }

    // 3. Detect Contact Windows / Passes
    this.candidatePasses = detectPasses(
      this.satellites,
      this.activeGroundStations,
      this.horizonSec,
      30
    );

    // 4. Run Baseline Scheduler (FCFS)
    this.fcfsResult = runFCFSScheduler(
      this.candidatePasses,
      this.satellites,
      this.activeGroundStations
    );

    // 5. Run Autonomous Optimization Engine
    this.optimizedResult = this.optimizerEngine.solve(
      this.candidatePasses,
      this.satellites,
      this.activeGroundStations
    );

    // 6. Update Visual Panels
    this.globe3D.setData(this.satellites, this.activeGroundStations, this.optimizedResult.scheduled);
    this.ganttChart.setData(this.activeGroundStations, this.optimizedResult, this.fcfsResult, this.horizonSec);
    this.analyticsHud.setData(this.optimizedResult, this.fcfsResult, this.satellites, this.satellites[0]?.id);

    // Default select first satellite
    if (this.satellites.length > 0) {
      this.onSatelliteSelected(this.satellites[0]);
    }

    // Update Counter badge
    const counterEl = document.getElementById('globe-sat-counter');
    if (counterEl) {
      counterEl.textContent = `${this.satellites.length} SATS | ${this.activeGroundStations.length} STATIONS | ${this.candidatePasses.length} PASSES`;
    }

    // Celebration Confetti if Optimizer outperforms FCFS by > 15%
    const delta = this.fcfsResult.totalWeightedScore > 0
      ? ((this.optimizedResult.totalWeightedScore - this.fcfsResult.totalWeightedScore) / this.fcfsResult.totalWeightedScore) * 100
      : 0;

    if (delta > 15) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#00f0ff', '#00ff9d', '#ffb800']
      });
    }
  }

  onSatelliteSelected(satellite) {
    this.selectedSatellite = satellite;
    if (this.attitudeMonitor) {
      this.attitudeMonitor.setSatellite(satellite);
    }
    if (this.globe3D) {
      this.globe3D.selectSatellite(satellite.id);
    }
  }

  onPassClicked(pass) {
    const sat = this.satellites.find(s => s.id === pass.satId);
    if (sat) {
      this.onSatelliteSelected(sat);
    }
  }

  seekToTime(sec) {
    this.simEpochSec = Math.max(0, Math.min(this.horizonSec, sec));
    if (this.controlPanel) {
      this.controlPanel.setTime(this.simEpochSec);
    }
    this.updateClockTick();
  }

  simLoop(timestamp) {
    requestAnimationFrame(this.simLoop);

    const deltaMs = timestamp - this.lastFrameTimestamp;
    this.lastFrameTimestamp = timestamp;

    if (this.isPlaying) {
      const deltaSec = (deltaMs / 1000) * this.timeSpeed;
      this.simEpochSec = (this.simEpochSec + deltaSec) % this.horizonSec;

      if (this.controlPanel) {
        this.controlPanel.setTime(Math.round(this.simEpochSec));
      }
    }

    this.updateClockTick();
  }

  updateClockTick() {
    const cur = this.simEpochSec;

    // Header Clock
    const headerClock = document.getElementById('header-utc-clock');
    if (headerClock) {
      const h = Math.floor(cur / 3600) % 24;
      const m = Math.floor((cur % 3600) / 60);
      const s = Math.floor(cur % 60);
      headerClock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
    }

    // Active schedule selection based on Gantt view mode
    const currentSchedule = this.ganttChart && this.ganttChart.viewMode === 'FCFS'
      ? (this.fcfsResult ? this.fcfsResult.scheduled : [])
      : (this.optimizedResult ? this.optimizedResult.scheduled : []);

    // 3D Globe update
    if (this.globe3D) {
      this.globe3D.setSchedule(currentSchedule);
      this.globe3D.updateAtTime(cur);
    }

    // Attitude Monitor update
    if (this.attitudeMonitor) {
      this.attitudeMonitor.updateAtTime(cur, currentSchedule, this.activeGroundStations);
    }

    // Gantt scrubber line update
    if (this.ganttChart) {
      this.ganttChart.updateScrubber(cur);
    }
  }

  exportScheduleJSON() {
    if (!this.optimizedResult) return;

    const exportData = {
      mission: 'Planet Labs SPACE-04 Multi-Satellite Downlink Schedule',
      generatedTimestampUTC: new Date().toISOString(),
      planningHorizonHours: 24,
      algorithm: this.optimizedResult.algorithm,
      metrics: {
        priorityWeightedScoreGB: this.optimizedResult.totalWeightedScore,
        totalRawPayloadGB: this.optimizedResult.totalRawDataGB,
        scheduledPassCount: this.optimizedResult.scheduledCount,
        rejectedPassCount: this.optimizedResult.rejectedCount,
        stationUtilizationPct: this.optimizedResult.stationUtilizationPct,
        slewConstraintViolations: this.optimizedResult.slewViolationCount,
        fcfsImprovementDeltaPct: this.fcfsResult ? (
          ((this.optimizedResult.totalWeightedScore - this.fcfsResult.totalWeightedScore) / this.fcfsResult.totalWeightedScore) * 100
        ).toFixed(2) : '0'
      },
      scheduledPasses: this.optimizedResult.scheduled.map(p => ({
        requestId: p.id,
        satelliteId: p.satId,
        satelliteName: p.satName,
        priorityTier: p.priority,
        groundStationId: p.stationId,
        groundStationName: p.stationName,
        aosSec: p.startSec,
        losSec: p.endSec,
        durationSec: p.durationSec,
        peakElevationDeg: p.peakElDeg,
        dataRateMbps: p.dataRateMbps,
        actualDownlinkDataGB: p.actualDataGB,
        nextSlewTransition: p.nextSlewDetails || null
      }))
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SPACE04_Optimized_Schedule_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MissionControlDashboard();
});
