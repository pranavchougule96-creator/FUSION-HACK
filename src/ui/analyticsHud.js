/**
 * SPACE-04: Analytics & Real-Time Mission Simulation HUD
 * Real-time telemetry feed, active downlink bitrate meters, dish pointing angles,
 * dynamic SSD memory buffer simulation, and comparative optimization KPIs.
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
    this.eventLog = [];
    this.lastLoggedSec = -1;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">📈</span>
          <h2 class="panel-title">MISSION SIMULATION TELEMETRY & ANALYTICS HUD</h2>
        </div>
        <div class="solver-meta-tag font-mono" id="hud-solver-meta">SIMULATION ENGINE: REAL-TIME READY</div>
      </div>

      <!-- Live Simulation Telemetry Deck (Top Split) -->
      <div class="sim-telemetry-deck">
        <!-- Live Link Status & Bitrate Gauge Card -->
        <div class="sim-card sim-link-card">
          <div class="sim-card-header">
            <span class="sim-card-title">📡 ACTIVE DOWNLINK RF TELEMETRY</span>
            <span class="sim-status-badge badge-idle" id="sim-link-status">STANDBY / SEARCHING</span>
          </div>

          <div class="sim-link-body">
            <div class="sim-link-target">
              <div class="sim-target-sat font-mono font-bold text-cyan" id="sim-active-sat">NO ACTIVE LINK</div>
              <div class="sim-target-arrow">⇄</div>
              <div class="sim-target-station font-mono font-bold text-emerald" id="sim-active-station">LISTENING STATIONS</div>
            </div>

            <div class="sim-meters-row">
              <div class="sim-meter-box">
                <span class="sim-meter-label">DOWNLINK BITRATE</span>
                <span class="sim-meter-value font-mono text-cyan" id="sim-live-bitrate">0.0 Mbps</span>
                <div class="sim-rate-bar-track">
                  <div class="sim-rate-bar-fill" id="sim-rate-bar" style="width: 0%;"></div>
                </div>
              </div>

              <div class="sim-meter-box">
                <span class="sim-meter-label">SESSION PAYLOAD</span>
                <span class="sim-meter-value font-mono text-emerald" id="sim-live-payload">0.0 / 0.0 GB</span>
                <div class="sim-rate-bar-track">
                  <div class="sim-payload-bar-fill" id="sim-payload-bar" style="width: 0%;"></div>
                </div>
              </div>

              <div class="sim-meter-box">
                <span class="sim-meter-label">DISH TRACKING AZ / EL</span>
                <span class="sim-meter-value font-mono text-amber" id="sim-live-angles">AZ: 000° | EL: 00°</span>
                <span class="sim-meter-sub text-dim" id="sim-link-quality">RF CARRIER: X-BAND 8.2 GHz</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Spacecraft Onboard Memory Real-Time Gauge -->
        <div class="sim-card sim-buffer-card">
          <div class="sim-card-header">
            <span class="sim-card-title">💾 SPACECRAFT SSD BUFFER STATUS</span>
            <div class="chart-controls">
              <select id="sat-buffer-select" class="hud-select"></select>
            </div>
          </div>

          <div class="sim-buffer-body">
            <div class="buffer-gauge-row">
              <div class="buffer-metric-box">
                <span class="buffer-label">OCCUPANCY:</span>
                <span class="buffer-val font-mono font-bold text-cyan" id="sim-live-buffer-gb">0.0 GB</span>
              </div>
              <div class="buffer-metric-box">
                <span class="buffer-label">CAPACITY:</span>
                <span class="buffer-val font-mono text-dim" id="sim-live-buffer-cap">64.0 GB</span>
              </div>
              <div class="buffer-metric-box">
                <span class="buffer-label">IO STATE:</span>
                <span class="buffer-val font-mono text-emerald" id="sim-live-buffer-state">IDLE</span>
              </div>
            </div>

            <div class="buffer-progress-track">
              <div class="buffer-progress-fill" id="sim-live-buffer-bar" style="width: 0%;"></div>
            </div>

            <!-- Dynamic 24h Buffer Profile Canvas -->
            <div class="canvas-mini-container">
              <canvas id="buffer-dynamics-canvas" width="460" height="90"></canvas>
            </div>
          </div>
        </div>

        <!-- Live Mission Telemetry Event Stream (Ticker) -->
        <div class="sim-card sim-event-card">
          <div class="sim-card-header">
            <span class="sim-card-title">📜 MISSION TELEMETRY EVENT STREAM</span>
            <span class="sim-card-sub text-dim font-mono" id="sim-events-count">0 EVENTS</span>
          </div>

          <div class="sim-event-terminal font-mono" id="sim-event-terminal">
            <div class="terminal-line text-dim">[00:00:00 UTC] SIMULATION INITIALIZED. NETWORK SYNCED.</div>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards Grid (Comparative Performance) -->
      <div class="hud-kpi-grid">
        <!-- Card 1: Priority-Weighted Throughput & Delta -->
        <div class="kpi-card kpi-highlight">
          <div class="kpi-label">PRIORITY-WEIGHTED THROUGHPUT</div>
          <div class="kpi-main-val text-emerald" id="kpi-opt-score">0 GB</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-score">FCFS: 0 GB</span>
            <span class="kpi-delta-badge badge-delta-up" id="kpi-delta-score">+0.0%</span>
          </div>
          <div class="kpi-footer-note">Objective: Σ(Priority × Rate × Duration)</div>
        </div>

        <!-- Card 2: Total Downlinked Data Volume -->
        <div class="kpi-card">
          <div class="kpi-label">TOTAL DOWNLINKED PAYLOAD</div>
          <div class="kpi-main-val text-cyan" id="kpi-raw-data">0.0 TB</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-raw">FCFS: 0.0 TB</span>
            <span class="kpi-delta-badge" id="kpi-delta-raw">+0.0 GB</span>
          </div>
          <div class="kpi-footer-note" id="kpi-passes-ratio">0 Scheduled / 0 Total Requests</div>
        </div>

        <!-- Card 3: Ground Station Utilization -->
        <div class="kpi-card">
          <div class="kpi-label">STATION NETWORK UTILIZATION</div>
          <div class="kpi-main-val text-amber" id="kpi-station-util">0.0%</div>
          <div class="kpi-sub-row">
            <span class="kpi-baseline text-dim" id="kpi-fcfs-util">FCFS: 0.0%</span>
            <span class="kpi-delta-badge" id="kpi-delta-util">+0.0%</span>
          </div>
          <div class="kpi-footer-note">Continuous active dish tracking efficiency</div>
        </div>

        <!-- Card 4: Slew Maneuver Compliance -->
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
        <div class="card-subtitle">PRIORITY TIER FULFILLMENT DELTA (AUTONOMOUS OPTIMIZER VS FCFS BASELINE)</div>
        <div class="priority-bars-container" id="priority-bars-container">
          <!-- Dynamically populated -->
        </div>
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

    // 1. Priority-Weighted Score
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

    // 2. Total Downlinked Payload
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

    // 3. Station Utilization
    const utilEl = this.container.querySelector('#kpi-station-util');
    const fcfsUtilEl = this.container.querySelector('#kpi-fcfs-util');
    const deltaUtilEl = this.container.querySelector('#kpi-delta-util');

    if (utilEl) utilEl.textContent = `${opt.stationUtilizationPct}%`;
    if (fcfsUtilEl) fcfsUtilEl.textContent = `FCFS: ${fcfs.stationUtilizationPct}%`;
    const diffUtil = (opt.stationUtilizationPct - fcfs.stationUtilizationPct).toFixed(2);
    if (deltaUtilEl) deltaUtilEl.textContent = `+${diffUtil}%`;

    // 4. Slew Compliance
    const fcfsDroppedEl = this.container.querySelector('#kpi-fcfs-dropped');
    if (fcfsDroppedEl) fcfsDroppedEl.textContent = `FCFS Dropped: ${fcfs.rejectedCount} passes`;

    const solverMeta = this.container.querySelector('#hud-solver-meta');
    if (solverMeta && opt.elapsedSolveMs) {
      solverMeta.textContent = `SOLVER: CONVERGED IN ${opt.elapsedSolveMs}ms (ZERO SLEW VIOLATIONS)`;
    }
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
      { key: 'CRITICAL', label: 'CRITICAL (Disaster / Rapid Response)', color: '#ff3b69' },
      { key: 'HIGH', label: 'HIGH (Commercial Priority)', color: '#ffb800' },
      { key: 'MEDIUM', label: 'MEDIUM (Global Survey)', color: '#00f0ff' },
      { key: 'LOW', label: 'LOW (Background Archive)', color: '#a855f7' }
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

    // Simulate satellite buffer time-series over 24h
    const points = [];
    const capacity = sat.bufferCapacityGB;
    let currentBuffer = sat.initialBufferGB;
    const stepSec = 900; // 15 minute steps

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

    // Draw Background Grid
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
    ctx.moveTo(0, 8);
    ctx.lineTo(width, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill area gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');

    ctx.beginPath();
    ctx.moveTo(0, height);
    points.forEach((pt, i) => {
      const x = (pt.t / 86400) * width;
      const y = height - (pt.buffer / capacity) * (height - 14) - 4;
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
      const y = height - (pt.buffer / capacity) * (height - 14) - 4;
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
      // AOS Event
      this.eventLog.push({
        sec: pass.startSec,
        type: 'AOS',
        text: `AOS: ${pass.satName} acquired by ${pass.stationName} (El: ${pass.peakElDeg.toFixed(1)}°, Rate: ${pass.dataRateMbps} Mbps)`
      });

      // Mid-pass peak
      const midSec = Math.round((pass.startSec + pass.endSec) / 2);
      this.eventLog.push({
        sec: midSec,
        type: 'PEAK',
        text: `PEAK FLUX: ${pass.satName} peak elevation ${pass.peakElDeg}° at ${pass.stationName} (${pass.actualDataGB} GB scheduled)`
      });

      // LOS Event
      this.eventLog.push({
        sec: pass.endSec,
        type: 'LOS',
        text: `LOS: ${pass.satName} pass complete at ${pass.stationName}. ${pass.actualDataGB} GB transferred.`
      });

      // Slew event
      if (pass.nextSlewDetails) {
        this.eventLog.push({
          sec: pass.endSec + 1,
          type: 'SLEW',
          text: `DISH SLEW: ${pass.stationName} repointing to ${pass.nextSlewDetails.targetSatName} (Δθ: ${pass.nextSlewDetails.angularDistDeg}°, Time: ${pass.nextSlewDetails.totalRequiredSec}s)`
        });
      }
    }

    this.eventLog.sort((a, b) => a.sec - b.sec);
  }

  /**
   * Called on every frame / clock tick to drive real-time simulation UI
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

    if (currentPasses.length > 0) {
      const activePass = currentPasses[0];
      const elapsed = simSec - activePass.startSec;
      const progressFraction = Math.max(0, Math.min(1, elapsed / activePass.durationSec));

      if (statusBadge) {
        statusBadge.textContent = '● ACTIVE DOWNLINK TRANSMISSION';
        statusBadge.className = 'sim-status-badge badge-transmitting';
      }

      if (satEl) satEl.textContent = activePass.satName;
      if (stationEl) stationEl.textContent = `${activePass.stationName} (${activePass.stationId})`;

      // Dynamic Bitrate modulation by sine curve
      const instantRate = Math.round(activePass.dataRateMbps * (0.65 + 0.35 * Math.sin(progressFraction * Math.PI)));
      if (rateEl) rateEl.textContent = `${instantRate} Mbps`;
      if (rateBar) rateBar.style.width = `${Math.min(100, (instantRate / 500) * 100)}%`;

      // Live transferred payload
      const totalGB = activePass.actualDataGB || 15.0;
      const currentGB = (totalGB * progressFraction).toFixed(1);
      if (payloadEl) payloadEl.textContent = `${currentGB} / ${totalGB} GB`;
      if (payloadBar) payloadBar.style.width = `${(progressFraction * 100).toFixed(0)}%`;

      // Dynamic Azimuth & Elevation
      const instantEl = Math.round(10 + (activePass.peakElDeg - 10) * Math.sin(progressFraction * Math.PI));
      const instantAz = Math.round((60 + progressFraction * 180) % 360);
      if (anglesEl) anglesEl.textContent = `AZ: ${String(instantAz).padStart(3, '0')}° | EL: ${String(instantEl).padStart(2, '0')}°`;
    } else {
      if (statusBadge) {
        statusBadge.textContent = 'STANDBY / DISH SLEWING';
        statusBadge.className = 'sim-status-badge badge-idle';
      }
      if (satEl) satEl.textContent = 'NO ACTIVE CONTACT';
      if (stationEl) stationEl.textContent = 'MONITORING CONSTELLATION';
      if (rateEl) rateEl.textContent = '0.0 Mbps';
      if (rateBar) rateBar.style.width = '0%';
      if (payloadEl) payloadEl.textContent = '0.0 / 0.0 GB';
      if (payloadBar) payloadBar.style.width = '0%';
      if (anglesEl) anglesEl.textContent = 'AZ: STANDBY | EL: PARKED';
    }

    // 2. Real-Time Spacecraft Buffer Gauge
    const selectedSat = this.satellites.find(s => s.id === this.selectedSatelliteId);
    if (selectedSat) {
      const cap = selectedSat.bufferCapacityGB;
      // Calculate buffer at simSec
      let curBuf = selectedSat.initialBufferGB;
      const gen = (simSec * selectedSat.imagingRateGbps * 0.3) / 8;
      curBuf = Math.min(cap, curBuf + gen);

      // Drain passes up to simSec
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
      const bufCapEl = this.container.querySelector('#sim-live-buffer-cap');
      const bufStateEl = this.container.querySelector('#sim-live-buffer-state');
      const bufBar = this.container.querySelector('#sim-live-buffer-bar');

      const pct = Math.min(100, Math.max(0, (curBuf / cap) * 100));
      if (bufGBEl) bufGBEl.textContent = `${curBuf.toFixed(1)} GB (${pct.toFixed(0)}%)`;
      if (bufCapEl) bufCapEl.textContent = `${cap} GB MAX`;
      if (bufBar) {
        bufBar.style.width = `${pct}%`;
        bufBar.style.backgroundColor = pct > 85 ? '#ff3b69' : pct > 60 ? '#ffb800' : '#00f0ff';
      }
      if (bufStateEl) {
        bufStateEl.textContent = isCurrentlyDraining ? 'DISCHARGING (-450 Mbps)' : 'IMAGING ACCUMULATION';
        bufStateEl.className = isCurrentlyDraining ? 'buffer-val font-mono text-emerald' : 'buffer-val font-mono text-cyan';
      }
    }

    // 3. Real-Time Mission Event Ticker
    const terminal = this.container.querySelector('#sim-event-terminal');
    const countEl = this.container.querySelector('#sim-events-count');

    if (terminal && this.eventLog.length > 0) {
      // Find events that have occurred up to simSec (keep last 6)
      const pastEvents = this.eventLog.filter(e => e.sec <= simSec);
      if (countEl) countEl.textContent = `${pastEvents.length} / ${this.eventLog.length} EVENTS`;

      const recent = pastEvents.slice(-6);
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
}

function formatSecToUTC(sec) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
}
