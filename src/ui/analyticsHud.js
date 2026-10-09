/**
 * SPACE-04: Analytics & Live Simulation Operations Deck
 * High-visibility real-time simulation engine: live RF bitstream counter, 2D dish tracking radar,
 * dynamic SSD memory buffer simulation, active telemetry dials, and mission event stream.
 */

export class AnalyticsHud {
  constructor(containerElement, onSelectSatelliteCallback = null) {
    this.container = containerElement;
    this.onSelectSatellite = onSelectSatelliteCallback;

    this.optimizedResult = null;
    this.fcfsResult = null;
    this.satellites = [];
    this.selectedSatelliteId = null;

    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.radarCanvas = null;
    this.radarCtx = null;
    this.eventLog = [];
    this.streamedMB = 0;
    this.lastActivePassId = null;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🛰️</span>
          <h2 class="panel-title">LIVE MISSION SIMULATION ENGINE & ANALYTICS DECK</h2>
        </div>
        <div class="sim-engine-live-badge font-mono" id="sim-engine-status">
          <span class="live-dot-pulse"></span>
          <span>SIMULATION: ACTIVE TELEMETRY STREAM</span>
        </div>
      </div>

      <!-- Live Simulation Command Deck (Top Row) -->
      <div class="sim-telemetry-deck">
        <!-- 1. Active Downlink RF Telemetry & Bitstream Counter -->
        <div class="sim-card sim-link-card">
          <div class="sim-card-header">
            <span class="sim-card-title">📡 REAL-TIME DOWNLINK TELEMETRY</span>
            <span class="sim-status-badge badge-idle" id="sim-link-status">STANDBY / SEARCHING</span>
          </div>

          <div class="sim-link-body">
            <div class="sim-link-target">
              <div class="sim-target-sat font-mono font-bold text-cyan" id="sim-active-sat">NO ACTIVE LINK</div>
              <div class="sim-target-arrow">⇄</div>
              <div class="sim-target-station font-mono font-bold text-emerald" id="sim-active-station">GROUND NETWORK</div>
            </div>

            <!-- Live Bitstream Counter Bar -->
            <div class="sim-bitstream-banner">
              <div class="bitstream-label font-mono">LIVE BITSTREAM:</div>
              <div class="bitstream-val font-mono font-bold text-emerald" id="sim-live-streamed-mb">0.0 MB TRANSFERRED</div>
              <span class="bitstream-stream-dots" id="sim-stream-dots">▰▰▰▰▰</span>
            </div>

            <div class="sim-meters-row">
              <div class="sim-meter-box">
                <span class="sim-meter-label">CHANNEL RATE</span>
                <span class="sim-meter-value font-mono text-cyan" id="sim-live-bitrate">0.0 Mbps</span>
                <div class="sim-rate-bar-track">
                  <div class="sim-rate-bar-fill" id="sim-rate-bar" style="width: 0%;"></div>
                </div>
              </div>

              <div class="sim-meter-box">
                <span class="sim-meter-label">PASS PROGRESS</span>
                <span class="sim-meter-value font-mono text-emerald" id="sim-live-payload">0.0 / 0.0 GB</span>
                <div class="sim-rate-bar-track">
                  <div class="sim-payload-bar-fill" id="sim-payload-bar" style="width: 0%;"></div>
                </div>
              </div>

              <div class="sim-meter-box">
                <span class="sim-meter-label">DISH AZ / EL</span>
                <span class="sim-meter-value font-mono text-amber" id="sim-live-angles">AZ: 000° | EL: 00°</span>
                <span class="sim-meter-sub text-dim">X-BAND 8.2 GHz</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Ground Station 2D Dish Sky Radar Compass -->
        <div class="sim-card sim-radar-card">
          <div class="sim-card-header">
            <span class="sim-card-title">🎯 DISH SKY TRACKING RADAR</span>
            <span class="sim-card-sub font-mono text-dim" id="sim-radar-station-name">GS-BLR (ISTRAC)</span>
          </div>

          <div class="radar-content-box">
            <div class="radar-canvas-container">
              <canvas id="dish-radar-canvas" width="160" height="160"></canvas>
            </div>
            <div class="radar-telemetry-col font-mono text-sm">
              <div class="r-item"><span class="text-dim">TARGET:</span> <span class="text-cyan font-bold" id="radar-sat-name">--</span></div>
              <div class="r-item"><span class="text-dim">AZIMUTH:</span> <span class="text-amber" id="radar-az">000.0°</span></div>
              <div class="r-item"><span class="text-dim">ELEVATION:</span> <span class="text-emerald" id="radar-el">00.0°</span></div>
              <div class="r-item"><span class="text-dim">DOPPLER:</span> <span class="text-cyan" id="radar-doppler">+0.0 kHz</span></div>
              <div class="r-item"><span class="text-dim">LINK MARGIN:</span> <span class="text-emerald font-bold" id="radar-margin">+6.5 dB</span></div>
            </div>
          </div>
        </div>

        <!-- 3. Spacecraft SSD Memory Buffer & Telemetry -->
        <div class="sim-card sim-buffer-card">
          <div class="sim-card-header">
            <span class="sim-card-title">💾 SPACECRAFT SSD BUFFER</span>
            <div class="chart-controls">
              <select id="sat-buffer-select" class="hud-select"></select>
            </div>
          </div>

          <div class="sim-buffer-body">
            <div class="buffer-gauge-row">
              <div class="buffer-metric-box">
                <span class="buffer-label">BUFFER OCCUPANCY:</span>
                <span class="buffer-val font-mono font-bold text-cyan" id="sim-live-buffer-gb">0.0 GB</span>
              </div>
              <div class="buffer-metric-box">
                <span class="buffer-label">IO STATE:</span>
                <span class="buffer-val font-mono text-emerald" id="sim-live-buffer-state">IDLE</span>
              </div>
            </div>

            <div class="buffer-progress-track">
              <div class="buffer-progress-fill" id="sim-live-buffer-bar" style="width: 0%;"></div>
            </div>

            <!-- Mini 24h Buffer Profile Canvas -->
            <div class="canvas-mini-container">
              <canvas id="buffer-dynamics-canvas" width="460" height="75"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Mission Event Stream Terminal -->
      <div class="sim-card sim-terminal-card">
        <div class="sim-card-header">
          <span class="sim-card-title">📜 LIVE MISSION TELEMETRY EVENT STREAM</span>
          <span class="sim-card-sub font-mono text-dim" id="sim-events-count">0 EVENTS</span>
        </div>
        <div class="sim-event-terminal font-mono" id="sim-event-terminal">
          <div class="terminal-line text-dim">[00:00:00 UTC] SIMULATION CLOCK SYNCHRONIZED. LEO ORBITAL PROPAGATION ACTIVE.</div>
        </div>
      </div>

      <!-- Comparative Performance KPIs Grid -->
      <div class="hud-kpi-grid">
        <div class="kpi-card kpi-highlight">
          <div class="kpi-label">PRIORITY-WEIGHTED THROUGHPUT</div>
          <div class="kpi-main-val text-emerald" id="kpi-opt-score">0 GB</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-score">FCFS: 0 GB</span>
            <span class="kpi-delta-badge badge-delta-up" id="kpi-delta-score">+0.0%</span>
          </div>
          <div class="kpi-footer-note">Objective: Σ(Priority × Rate × Duration)</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">TOTAL DOWNLINKED PAYLOAD</div>
          <div class="kpi-main-val text-cyan" id="kpi-raw-data">0.0 TB</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-raw">FCFS: 0.0 TB</span>
            <span class="kpi-delta-badge" id="kpi-delta-raw">+0.0 GB</span>
          </div>
          <div class="kpi-footer-note" id="kpi-passes-ratio">0 Scheduled / 0 Requests</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">STATION NETWORK UTILIZATION</div>
          <div class="kpi-main-val text-amber" id="kpi-station-util">0.0%</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-util">FCFS: 0.0%</span>
            <span class="kpi-delta-badge" id="kpi-delta-util">+0.0%</span>
          </div>
          <div class="kpi-footer-note">Continuous active tracking efficiency</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">SLEW CONSTRAINT VIOLATIONS</div>
          <div class="kpi-main-val text-emerald" id="kpi-slew-violations">0 VIOLATIONS</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-coral" id="kpi-fcfs-dropped">FCFS Conflicts: 0</span>
            <span class="kpi-delta-badge badge-safe">100% COMPLIANT</span>
          </div>
          <div class="kpi-footer-note">Zero RF lock acquisition failure margin</div>
        </div>
      </div>

      <!-- Priority Tier Comparison Card -->
      <div class="hud-priority-card">
        <div class="card-subtitle">PRIORITY TIER FULFILLMENT DELTA (AUTONOMOUS SOLVER VS NAIVE FCFS)</div>
        <div class="priority-bars-container" id="priority-bars-container"></div>
      </div>
    `;

    // Dropdown change listener
    const satSelect = this.container.querySelector('#sat-buffer-select');
    satSelect.addEventListener('change', (e) => {
      this.selectedSatelliteId = e.target.value;
      this.renderBufferChart();
      if (this.onSelectSatellite) {
        const sat = this.satellites.find(s => s.id === this.selectedSatelliteId);
        if (sat) this.onSelectSatellite(sat);
      }
    });

    this.bufferCanvas = this.container.querySelector('#buffer-dynamics-canvas');
    if (this.bufferCanvas) {
      this.bufferCtx = this.bufferCanvas.getContext('2d');
    }

    this.radarCanvas = this.container.querySelector('#dish-radar-canvas');
    if (this.radarCanvas) {
      this.radarCtx = this.radarCanvas.getContext('2d');
    }
  }

  setData(optimizedResult, fcfsResult, satellites, selectedSatId = null) {
    this.optimizedResult = optimizedResult;
    this.fcfsResult = fcfsResult;
    this.satellites = satellites;

    if (selectedSatId) {
      this.selectedSatelliteId = selectedSatId;
    } else if (!this.selectedSatelliteId && satellites.length > 0) {
      this.selectedSatelliteId = satellites[0].id;
    }

    this.updateKPIs();
    this.populateSatDropdown();
    this.renderPriorityBars();
    this.renderBufferChart();
    this.buildSimulationEventLog();
  }

  updateKPIs() {
    if (!this.optimizedResult || !this.fcfsResult) return;

    const opt = this.optimizedResult;
    const fcfs = this.fcfsResult;

    const optScoreEl = this.container.querySelector('#kpi-opt-score');
    const fcfsScoreEl = this.container.querySelector('#kpi-fcfs-score');
    const deltaScoreEl = this.container.querySelector('#kpi-delta-score');

    if (optScoreEl) optScoreEl.textContent = `${Math.round(opt.totalWeightedScore).toLocaleString()} GB`;
    if (fcfsScoreEl) fcfsScoreEl.textContent = `FCFS: ${Math.round(fcfs.totalWeightedScore).toLocaleString()} GB`;

    const deltaPct = fcfs.totalWeightedScore > 0
      ? (((opt.totalWeightedScore - fcfs.totalWeightedScore) / fcfs.totalWeightedScore) * 100).toFixed(1)
      : '0.0';
    if (deltaScoreEl) {
      deltaScoreEl.textContent = `+${deltaPct}% DELTA`;
      deltaScoreEl.className = deltaPct >= 0 ? 'kpi-delta-badge badge-delta-up' : 'kpi-delta-badge';
    }

    const rawDataEl = this.container.querySelector('#kpi-raw-data');
    const fcfsRawEl = this.container.querySelector('#kpi-fcfs-raw');
    const deltaRawEl = this.container.querySelector('#kpi-delta-raw');
    const passesRatioEl = this.container.querySelector('#kpi-passes-ratio');

    const optTB = (opt.totalRawDataGB / 1000).toFixed(2);
    const fcfsTB = (fcfs.totalRawDataGB / 1000).toFixed(2);
    const diffGB = (opt.totalRawDataGB - fcfs.totalRawDataGB).toFixed(1);

    if (rawDataEl) rawDataEl.textContent = `${optTB} TB`;
    if (fcfsRawEl) fcfsRawEl.textContent = `FCFS: ${fcfsTB} TB`;
    if (deltaRawEl) deltaRawEl.textContent = `+${diffGB} GB`;
    if (passesRatioEl) {
      passesRatioEl.textContent = `${opt.scheduledCount} Scheduled / ${opt.totalRequests} Requests (${opt.rejectedCount} Rejected)`;
    }

    const utilEl = this.container.querySelector('#kpi-station-util');
    const fcfsUtilEl = this.container.querySelector('#kpi-fcfs-util');
    const deltaUtilEl = this.container.querySelector('#kpi-delta-util');

    if (utilEl) utilEl.textContent = `${opt.stationUtilizationPct}%`;
    if (fcfsUtilEl) fcfsUtilEl.textContent = `FCFS: ${fcfs.stationUtilizationPct}%`;
    const diffUtil = (opt.stationUtilizationPct - fcfs.stationUtilizationPct).toFixed(2);
    if (deltaUtilEl) deltaUtilEl.textContent = `+${diffUtil}%`;

    const fcfsDroppedEl = this.container.querySelector('#kpi-fcfs-dropped');
    if (fcfsDroppedEl) fcfsDroppedEl.textContent = `FCFS Dropped: ${fcfs.rejectedCount} passes`;
  }

  populateSatDropdown() {
    const sel = this.container.querySelector('#sat-buffer-select');
    if (!sel) return;

    sel.innerHTML = '';
    for (const sat of this.satellites) {
      const opt = document.createElement('option');
      opt.value = sat.id;
      opt.textContent = `${sat.name} (${sat.priority} - ${sat.bufferCapacityGB} GB)`;
      if (sat.id === this.selectedSatelliteId) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    }
  }

  renderPriorityBars() {
    const container = this.container.querySelector('#priority-bars-container');
    if (!container || !this.optimizedResult || !this.fcfsResult) return;

    const optBD = this.optimizedResult.priorityBreakdown;
    const fcfsBD = this.fcfsResult.priorityBreakdown;

    const tiers = [
      { key: 'CRITICAL', label: 'CRITICAL (Disaster Alert / ISRO Primary)', color: '#ff3b69' },
      { key: 'HIGH', label: 'HIGH (Commercial VIP / High-Res)', color: '#ffb800' },
      { key: 'MEDIUM', label: 'MEDIUM (Global Survey / PlanetScope)', color: '#00f0ff' },
      { key: 'LOW', label: 'LOW (Background Calibration / ISS)', color: '#a855f7' }
    ];

    let html = '';
    tiers.forEach(t => {
      const optItem = optBD[t.key] || { scheduled: 0, dropped: 0 };
      const fcfsItem = fcfsBD[t.key] || { scheduled: 0, dropped: 0 };
      const total = optItem.scheduled + optItem.dropped || 1;

      const optPct = Math.round((optItem.scheduled / total) * 100);
      const fcfsPct = Math.round((fcfsItem.scheduled / total) * 100);

      html += `
        <div class="priority-bar-item">
          <div class="p-header-line">
            <span class="p-label" style="color: ${t.color}">${t.label}</span>
            <span class="p-scores font-mono">
              <strong class="text-emerald">${optPct}% OPTIMIZED</strong> vs <span class="text-dim">${fcfsPct}% FCFS</span>
            </span>
          </div>
          <div class="p-bar-track">
            <div class="p-bar-fill opt-fill" style="width: ${optPct}%; background-color: ${t.color}"></div>
            <div class="p-bar-marker fcfs-marker" style="left: ${fcfsPct}%;" title="FCFS: ${fcfsPct}%"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  renderBufferChart() {
    if (!this.bufferCanvas || !this.bufferCtx || !this.satellites) return;

    const ctx = this.bufferCtx;
    const width = this.bufferCanvas.width;
    const height = this.bufferCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const sat = this.satellites.find(s => s.id === this.selectedSatelliteId);
    if (!sat) return;

    const points = [];
    const capacity = sat.bufferCapacityGB;
    let currentBuffer = sat.initialBufferGB;
    const stepSec = 900;

    const satPasses = this.optimizedResult
      ? this.optimizedResult.scheduled.filter(p => p.satId === sat.id)
      : [];

    let passIdx = 0;
    satPasses.sort((a, b) => a.startSec - b.startSec);

    for (let t = 0; t <= 86400; t += stepSec) {
      const generated = (stepSec * sat.imagingRateGbps * 0.3) / 8;
      currentBuffer = Math.min(capacity, currentBuffer + generated);

      while (passIdx < satPasses.length && satPasses[passIdx].endSec <= t) {
        const pass = satPasses[passIdx];
        currentBuffer = Math.max(0, currentBuffer - pass.actualDataGB);
        passIdx++;
      }

      points.push({ t, buffer: currentBuffer });
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let h = 0; h <= 24; h += 4) {
      const x = (h / 24) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Capacity reference line
    ctx.strokeStyle = 'rgba(255, 59, 105, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(width, 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');

    ctx.beginPath();
    ctx.moveTo(0, height);
    points.forEach((pt, i) => {
      const x = (pt.t / 86400) * width;
      const y = height - (pt.buffer / capacity) * (height - 12) - 4;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = (pt.t / 86400) * width;
      const y = height - (pt.buffer / capacity) * (height - 12) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  buildSimulationEventLog() {
    this.eventLog = [];
    if (!this.optimizedResult) return;

    for (const pass of this.optimizedResult.scheduled) {
      this.eventLog.push({
        sec: pass.startSec,
        type: 'AOS',
        text: `AOS: ${pass.satName} acquired RF lock on ${pass.stationName} (El: ${pass.peakElDeg.toFixed(1)}°, Rate: ${pass.dataRateMbps} Mbps)`
      });

      const midSec = Math.round((pass.startSec + pass.endSec) / 2);
      this.eventLog.push({
        sec: midSec,
        type: 'PEAK',
        text: `MAX FLUX: Peak elevation ${pass.peakElDeg}° achieved at ${pass.stationName}. Downlinking ${pass.actualDataGB} GB.`
      });

      this.eventLog.push({
        sec: pass.endSec,
        type: 'LOS',
        text: `LOS: ${pass.satName} pass complete at ${pass.stationName}. Payload offloaded: ${pass.actualDataGB} GB.`
      });

      if (pass.nextSlewDetails) {
        this.eventLog.push({
          sec: pass.endSec + 1,
          type: 'SLEW',
          text: `DISH REPOINTING: ${pass.stationName} slewing to ${pass.nextSlewDetails.targetSatName} (Δθ: ${pass.nextSlewDetails.angularDistDeg}°, Time: ${pass.nextSlewDetails.totalRequiredSec}s)`
        });
      }
    }

    this.eventLog.sort((a, b) => a.sec - b.sec);
  }

  /**
   * Drives the live simulation update loop every frame
   */
  updateSimulation(simSec, activeSchedule = []) {
    // 1. Check for Active Downlink Passes at current simSec
    const currentPasses = activeSchedule.filter(
      p => simSec >= p.startSec && simSec <= p.endSec
    );

    const statusBadge = this.container.querySelector('#sim-link-status');
    const satEl = this.container.querySelector('#sim-active-sat');
    const stationEl = this.container.querySelector('#sim-active-station');
    const rateEl = this.container.querySelector('#sim-live-bitrate');
    const rateBar = this.container.querySelector('#sim-rate-bar');
    const payloadEl = this.container.querySelector('#sim-live-payload');
    const payloadBar = this.container.querySelector('#sim-payload-bar');
    const anglesEl = this.container.querySelector('#sim-live-angles');
    const mbCounterEl = this.container.querySelector('#sim-live-streamed-mb');
    const streamDotsEl = this.container.querySelector('#sim-stream-dots');

    let activeAz = 0;
    let activeEl = 0;
    let activeSatName = '--';

    if (currentPasses.length > 0) {
      const activePass = currentPasses[0];
      const elapsed = simSec - activePass.startSec;
      const progressFraction = Math.max(0, Math.min(1, elapsed / activePass.durationSec));

      if (statusBadge) {
        statusBadge.textContent = '● CARRIER LOCKED & DOWNLINKING';
        statusBadge.className = 'sim-status-badge badge-transmitting';
      }

      activeSatName = activePass.satName;
      if (satEl) satEl.textContent = activePass.satName;
      if (stationEl) stationEl.textContent = `${activePass.stationName} (${activePass.stationId})`;

      // Dynamic Bitrate
      const instantRate = Math.round(activePass.dataRateMbps * (0.7 + 0.3 * Math.sin(progressFraction * Math.PI)));
      if (rateEl) rateEl.textContent = `${instantRate} Mbps`;
      if (rateBar) rateBar.style.width = `${Math.min(100, (instantRate / 600) * 100)}%`;

      // Live payload GB and live MB counter
      const totalGB = activePass.actualDataGB || 18.0;
      const currentGB = totalGB * progressFraction;
      const currentMB = Math.round(currentGB * 1024);

      if (payloadEl) payloadEl.textContent = `${currentGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`;
      if (payloadBar) payloadBar.style.width = `${(progressFraction * 100).toFixed(0)}%`;

      if (mbCounterEl) {
        mbCounterEl.textContent = `${currentMB.toLocaleString()} MB DOWNLINKED`;
      }
      if (streamDotsEl) {
        const dotStates = ['▰▱▱▱▱', '▰▰▱▱▱', '▰▰▰▱▱', '▰▰▰▰▱', '▰▰▰▰▰'];
        const dotIdx = Math.floor((Date.now() / 150) % dotStates.length);
        streamDotsEl.textContent = dotStates[dotIdx];
        streamDotsEl.className = 'bitstream-stream-dots text-emerald';
      }

      // Dynamic Azimuth & Elevation
      activeEl = Math.round(10 + (activePass.peakElDeg - 10) * Math.sin(progressFraction * Math.PI));
      activeAz = Math.round((45 + progressFraction * 210) % 360);
      if (anglesEl) anglesEl.textContent = `AZ: ${String(activeAz).padStart(3, '0')}° | EL: ${String(activeEl).padStart(2, '0')}°`;

      // Radar telemetry readouts
      const rSat = this.container.querySelector('#radar-sat-name');
      const rAz = this.container.querySelector('#radar-az');
      const rEl = this.container.querySelector('#radar-el');
      const rDoppler = this.container.querySelector('#radar-doppler');
      const rMargin = this.container.querySelector('#radar-margin');
      const rStation = this.container.querySelector('#sim-radar-station-name');

      if (rSat) rSat.textContent = activePass.satName;
      if (rAz) rAz.textContent = `${activeAz}°`;
      if (rEl) rEl.textContent = `${activeEl}°`;
      if (rStation) rStation.textContent = activePass.stationName;

      // Doppler shift: positive at AOS, 0 at peak, negative at LOS
      const dopplerKHz = ((0.5 - progressFraction) * 45).toFixed(1);
      if (rDoppler) rDoppler.textContent = `${dopplerKHz >= 0 ? '+' : ''}${dopplerKHz} kHz`;
      if (rMargin) rMargin.textContent = `+${(5.5 + 4.0 * Math.sin(progressFraction * Math.PI)).toFixed(1)} dB`;
    } else {
      if (statusBadge) {
        statusBadge.textContent = 'STANDBY / DISH SLEWING';
        statusBadge.className = 'sim-status-badge badge-idle';
      }
      if (satEl) satEl.textContent = 'SEARCHING CONSTELLATION';
      if (stationEl) stationEl.textContent = 'MONITORING CHANNELS';
      if (rateEl) rateEl.textContent = '0.0 Mbps';
      if (rateBar) rateBar.style.width = '0%';
      if (payloadEl) payloadEl.textContent = '0.0 / 0.0 GB';
      if (payloadBar) payloadBar.style.width = '0%';
      if (anglesEl) anglesEl.textContent = 'AZ: PARKED | EL: 10.0°';
      if (mbCounterEl) mbCounterEl.textContent = '0 MB / CARRIER STANDBY';
      if (streamDotsEl) {
        streamDotsEl.textContent = '▱▱▱▱▱';
        streamDotsEl.className = 'bitstream-stream-dots text-dim';
      }
    }

    // 2. Draw 2D Ground Station Sky Tracking Radar Screen
    this.drawDishRadar(activeAz, activeEl, currentPasses.length > 0);

    // 3. Real-Time Spacecraft Buffer Gauge
    const selectedSat = this.satellites.find(s => s.id === this.selectedSatelliteId);
    if (selectedSat) {
      const cap = selectedSat.bufferCapacityGB;
      let curBuf = selectedSat.initialBufferGB;
      const gen = (simSec * selectedSat.imagingRateGbps * 0.3) / 8;
      curBuf = Math.min(cap, curBuf + gen);

      const passes = activeSchedule.filter(p => p.satId === selectedSat.id && p.startSec <= simSec);
      let isCurrentlyDraining = false;

      passes.forEach(p => {
        if (simSec >= p.endSec) {
          curBuf = Math.max(0, curBuf - p.actualDataGB);
        } else if (simSec >= p.startSec) {
          const frac = (simSec - p.startSec) / p.durationSec;
          curBuf = Math.max(0, curBuf - p.actualDataGB * frac);
          isCurrentlyDraining = true;
        }
      });

      const bufGBEl = this.container.querySelector('#sim-live-buffer-gb');
      const bufStateEl = this.container.querySelector('#sim-live-buffer-state');
      const bufBar = this.container.querySelector('#sim-live-buffer-bar');

      const pct = Math.min(100, Math.max(0, (curBuf / cap) * 100));
      if (bufGBEl) bufGBEl.textContent = `${curBuf.toFixed(1)} GB / ${cap} GB (${pct.toFixed(0)}%)`;
      if (bufBar) {
        bufBar.style.width = `${pct}%`;
        bufBar.style.backgroundColor = pct > 85 ? '#ff3b69' : pct > 60 ? '#ffb800' : '#00f0ff';
      }
      if (bufStateEl) {
        bufStateEl.textContent = isCurrentlyDraining ? 'DISCHARGING (-X-BAND)' : 'IMAGING ACCUMULATION';
        bufStateEl.className = isCurrentlyDraining ? 'buffer-val font-mono text-emerald' : 'buffer-val font-mono text-cyan';
      }
    }

    // 4. Real-Time Mission Event Ticker
    const terminal = this.container.querySelector('#sim-event-terminal');
    const countEl = this.container.querySelector('#sim-events-count');

    if (terminal && this.eventLog.length > 0) {
      const pastEvents = this.eventLog.filter(e => e.sec <= simSec);
      if (countEl) countEl.textContent = `${pastEvents.length} / ${this.eventLog.length} EVENTS`;

      const recent = pastEvents.slice(-7);
      if (recent.length > 0) {
        let html = '';
        recent.forEach(ev => {
          const utc = formatSecToUTC(ev.sec);
          let colorClass = 'text-cyan';
          if (ev.type === 'AOS') colorClass = 'text-emerald';
          else if (ev.type === 'LOS') colorClass = 'text-amber';
          else if (ev.type === 'SLEW') colorClass = 'text-coral';

          html += `<div class="terminal-line"><span class="text-dim">[${utc}]</span> <span class="${colorClass}">${ev.text}</span></div>`;
        });
        terminal.innerHTML = html;
        terminal.scrollTop = terminal.scrollHeight;
      }
    }
  }

  drawDishRadar(azDeg, elDeg, isLocked) {
    if (!this.radarCanvas || !this.radarCtx) return;

    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.44;

    ctx.clearRect(0, 0, w, h);

    // Radar background
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Elevation rings: 10°, 30°, 60°, 90° (center)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;

    [0.33, 0.66, 1.0].forEach(frac => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Cardinal direction labels
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - radius + 8);
    ctx.fillText('S', cx, cy + radius - 8);
    ctx.fillText('E', cx + radius - 8, cy);
    ctx.fillText('W', cx - radius + 8, cy);

    // Rotating Radar Sweep Beam
    const sweepAngle = (Date.now() / 600) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
    ctx.stroke();

    // Active Satellite Blip if locked
    if (isLocked && elDeg >= 10) {
      // Convert Azimuth (0° is North) & Elevation (90° is center) to canvas coords
      const azRad = ((azDeg - 90) * Math.PI) / 180;
      const elDist = (1 - (elDeg - 10) / 80) * radius;

      const blipX = cx + Math.cos(azRad) * elDist;
      const blipY = cy + Math.sin(azRad) * elDist;

      // Glowing pulsing blip
      ctx.fillStyle = 'rgba(0, 255, 157, 0.35)';
      ctx.beginPath();
      ctx.arc(blipX, blipY, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00ff9d';
      ctx.beginPath();
      ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function formatSecToUTC(sec) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
}
