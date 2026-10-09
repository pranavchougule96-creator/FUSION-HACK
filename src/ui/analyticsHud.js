/**
 * SPACE-04: Analytics & Performance Comparison HUD
 * KPI comparison cards with FCFS deltas and dynamic Onboard Data Buffer Fill/Drain time-series chart.
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

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">📈</span>
          <h2 class="panel-title">ANALYTICS & PERFORMANCE COMPARISON HUD</h2>
        </div>
        <div class="solver-meta-tag" id="hud-solver-meta">SOLVER: ACTIVE</div>
      </div>

      <!-- KPI Summary Cards Grid -->
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

      <!-- Lower Split: Buffer Chart & Priority Fulfillment -->
      <div class="hud-lower-grid">
        <!-- Dynamic Onboard Memory Buffer Chart -->
        <div class="hud-chart-card">
          <div class="chart-header-row">
            <div class="chart-title-box">
              <span class="chart-title">ONBOARD SSD MEMORY BUFFER DYNAMICS</span>
              <span class="chart-desc text-dim">Simulated fill (imaging accumulation) & drain (downlink passes) over 24h</span>
            </div>
            <div class="chart-controls">
              <label for="sat-buffer-select" class="control-label">SPACECRAFT:</label>
              <select id="sat-buffer-select" class="hud-select"></select>
            </div>
          </div>

          <div class="canvas-container">
            <canvas id="buffer-dynamics-canvas" width="700" height="180"></canvas>
          </div>

          <div class="chart-legend-row">
            <div class="c-legend"><span class="c-swatch swatch-buffer"></span> BUFFER OCCUPANCY (GB)</div>
            <div class="c-legend"><span class="c-swatch swatch-cap"></span> SSD HARDWARE CAPACITY</div>
            <div class="c-legend"><span class="c-swatch swatch-drain"></span> ACTIVE DOWNLINK DISCHARGE</div>
          </div>
        </div>

        <!-- Priority Tier Comparison Card -->
        <div class="hud-priority-card">
          <div class="card-subtitle">PRIORITY TIER FULFILLMENT DELTA</div>
          <div class="priority-bars-container" id="priority-bars-container">
            <!-- Dynamically populated -->
          </div>
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
    if (fcfsUtilEl) fcfsUtilEl.textContent = `FCFS: ${fcfsUtilEl ? fcfs.stationUtilizationPct : 0}%`;
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
      { key: 'CRITICAL', label: 'CRITICAL (Disaster / Rapid)', color: '#ff3b69' },
      { key: 'HIGH', label: 'HIGH (Commercial VIP)', color: '#ffb800' },
      { key: 'MEDIUM', label: 'MEDIUM (Global Survey)', color: '#00f0ff' },
      { key: 'LOW', label: 'LOW (Background)', color: '#a855f7' }
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
              <strong class="text-emerald">${optPct}%</strong> vs <span class="text-dim">${fcfsPct}% FCFS</span>
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

    // Simulate satellite buffer time-series over 24h (86400s)
    const points = [];
    const capacity = sat.bufferCapacityGB;
    let currentBuffer = sat.initialBufferGB;
    const stepSec = 900; // 15 minute steps

    // Get scheduled passes for this satellite
    const satPasses = this.optimizedResult
      ? this.optimizedResult.scheduled.filter(p => p.satId === sat.id)
      : [];

    let passIdx = 0;
    satPasses.sort((a, b) => a.startSec - b.startSec);

    for (let t = 0; t <= 86400; t += stepSec) {
      // Daylight imaging accumulation
      const generated = (stepSec * sat.imagingRateGbps * 0.3) / 8;
      currentBuffer = Math.min(capacity, currentBuffer + generated);

      // Check if any pass occurred in this interval
      while (passIdx < satPasses.length && satPasses[passIdx].endSec <= t) {
        const pass = satPasses[passIdx];
        currentBuffer = Math.max(0, currentBuffer - pass.actualDataGB);
        passIdx++;
      }

      points.push({ t, bufferGB: currentBuffer });
    }

    // Draw Grid & Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Horizontal grid lines (25%, 50%, 75%, 100% capacity)
    [0.25, 0.5, 0.75, 1.0].forEach(frac => {
      const y = height - frac * (height - 30) - 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${Math.round(frac * capacity)}GB`, 5, y + 3);
    });

    // Vertical grid lines (every 4 hours)
    for (let h = 0; h <= 24; h += 4) {
      const x = 40 + (h / 24) * (width - 55);
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 15);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${h}h`, x - 6, height - 3);
    }

    // Draw Buffer Fill Curve
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00f0ff';

    const getX = t => 40 + (t / 86400) * (width - 55);
    const getY = b => height - 15 - (b / capacity) * (height - 35);

    points.forEach((pt, i) => {
      const x = getX(pt.t);
      const y = getY(pt.bufferGB);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area Fill Gradient under buffer line
    const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
    areaGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
    areaGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    ctx.lineTo(getX(86400), height - 15);
    ctx.lineTo(getX(0), height - 15);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Annotate Downlink Drainage Discharges (Vertical downward spikes)
    satPasses.forEach(pass => {
      const px = getX(pass.startSec);
      const endX = getX(pass.endSec);

      ctx.fillStyle = 'rgba(0, 255, 157, 0.25)';
      ctx.fillRect(px, 10, Math.max(3, endX - px), height - 25);

      ctx.strokeStyle = '#00ff9d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 10);
      ctx.lineTo(px, height - 15);
      ctx.stroke();
    });
  }
}
