/**
 * SPACE-04: Multi-Track Ground Station Timetable Matrix & Gantt Scheduler
 * Futuristic telemetry track visualization with station filters, time zoom,
 * telemetry capsule pass blocks, animated slew repointing zones, and radar sweep line.
 */

export class MultiTrackGanttChart {
  constructor(containerElement, onSeekCallback = null, onPassClickCallback = null) {
    this.container = containerElement;
    this.onSeek = onSeekCallback;
    this.onPassClick = onPassClickCallback;

    this.groundStations = [];
    this.optimizedResult = null;
    this.fcfsResult = null;
    this.viewMode = 'OPTIMIZED'; // 'OPTIMIZED' | 'FCFS' | 'DIFF_OVERLAY'
    this.stationFilter = 'ALL';  // 'ALL' | 'ISRO' | 'POLAR'

    this.horizonSec = 86400; // 24 hours
    this.currentSec = 0;
    this.selectedPassId = null;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">📡</span>
          <h2 class="panel-title">MULTI-TRACK GROUND NETWORK TIMETABLE MATRIX</h2>
        </div>
        
        <div class="gantt-controls-row">
          <!-- Station Filter Pills -->
          <div class="pill-group-wrapper">
            <span class="toggle-label">NETWORK:</span>
            <div class="pill-group">
              <button class="pill-btn active" data-filter="ALL" id="filter-all">ALL STATIONS</button>
              <button class="pill-btn" data-filter="ISRO" id="filter-isro">🇮🇳 ISRO HUBS</button>
              <button class="pill-btn" data-filter="POLAR" id="filter-polar">🏔️ POLAR GATEWAYS</button>
            </div>
          </div>

          <!-- Schedule View Toggles -->
          <div class="pill-group-wrapper">
            <span class="toggle-label">SCHEDULE:</span>
            <div class="pill-group">
              <button class="pill-btn active" data-mode="OPTIMIZED" id="btn-mode-opt">
                <span class="pill-dot dot-opt"></span> OPTIMIZED (ILP)
              </button>
              <button class="pill-btn" data-mode="FCFS" id="btn-mode-fcfs">
                <span class="pill-dot dot-fcfs"></span> FCFS BASELINE
              </button>
              <button class="pill-btn" data-mode="DIFF_OVERLAY" id="btn-mode-diff">
                <span class="pill-dot dot-diff"></span> RESCUE DIFF
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Priority & Telemetry Legend Bar -->
      <div class="gantt-legend-bar">
        <div class="legend-item"><span class="legend-swatch legend-crit"></span> CRITICAL (10x Disaster / ISRO Primary)</div>
        <div class="legend-item"><span class="legend-swatch legend-high"></span> HIGH (5x VIP Commercial)</div>
        <div class="legend-item"><span class="legend-swatch legend-med"></span> MEDIUM (2.5x Planet Daily)</div>
        <div class="legend-item"><span class="legend-swatch legend-low"></span> LOW (1.0x ISS / Telemetry)</div>
        <div class="legend-item"><span class="legend-swatch legend-slew"></span> ANTENNA REPOINTING (SLEW)</div>
        <div class="legend-item"><span class="legend-swatch legend-dropped"></span> FCFS DROPPED CONFLICT</div>
      </div>

      <!-- Gantt Viewport Container -->
      <div class="gantt-viewport" id="gantt-viewport">
        <!-- Time Scale Header -->
        <div class="gantt-timescale-track" id="gantt-timescale"></div>

        <!-- Tracks Container -->
        <div class="gantt-tracks-container" id="gantt-tracks-container"></div>

        <!-- Radar Sweep Scrubber Line -->
        <div class="gantt-scrubber-line" id="gantt-scrubber-line">
          <div class="scrubber-head font-mono" id="gantt-scrubber-label">00:00:00 UTC</div>
        </div>
      </div>

      <!-- Tooltip Popover -->
      <div class="gantt-tooltip" id="gantt-tooltip" style="display: none;"></div>
    `;

    // View toggle listeners
    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setViewMode(mode);
      });
    });

    // Station filter listeners
    this.container.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.stationFilter = btn.dataset.filter;
        this.container.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render();
      });
    });

    // Timeline Scrubber Click / Seek
    const viewport = this.container.querySelector('#gantt-viewport');
    viewport.addEventListener('click', (e) => {
      const rect = viewport.getBoundingClientRect();
      const clickX = e.clientX - rect.left - 230; // track label offset
      const trackWidth = rect.width - 230;
      if (clickX >= 0 && trackWidth > 0) {
        const fraction = Math.max(0, Math.min(1, clickX / trackWidth));
        const targetSec = Math.round(fraction * this.horizonSec);
        if (this.onSeek) {
          this.onSeek(targetSec);
        }
      }
    });
  }

  setData(groundStations, optimizedResult, fcfsResult, horizonSec = 86400) {
    this.groundStations = groundStations;
    this.optimizedResult = optimizedResult;
    this.fcfsResult = fcfsResult;
    this.horizonSec = horizonSec;

    this.render();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.container.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    this.render();
  }

  getFilteredStations() {
    if (this.stationFilter === 'ISRO') {
      return this.groundStations.filter(s => s.id === 'GS-BLR' || s.id === 'GS-LKO' || s.id === 'GS-IXZ');
    } else if (this.stationFilter === 'POLAR') {
      return this.groundStations.filter(s => s.id === 'GS-SVB' || s.id === 'GS-INU' || s.id === 'GS-TRL' || s.id === 'GS-PUQ');
    }
    return this.groundStations;
  }

  render() {
    this.renderTimescale();
    this.renderTracks();
    this.updateScrubber(this.currentSec);
  }

  renderTimescale() {
    const scaleEl = this.container.querySelector('#gantt-timescale');
    if (!scaleEl) return;

    let html = `<div class="track-header-spacer font-mono font-bold">STATION RADAR POD</div>`;
    html += `<div class="timescale-ticks-wrapper">`;

    const hours = this.horizonSec / 3600;
    for (let h = 0; h <= hours; h += 2) {
      const leftPct = (h / hours) * 100;
      const timeStr = `${String(h).padStart(2, '0')}:00 UTC`;
      html += `
        <div class="timescale-tick" style="left: ${leftPct}%;">
          <span class="tick-line"></span>
          <span class="tick-label font-mono">${timeStr}</span>
        </div>
      `;
    }
    html += `</div>`;
    scaleEl.innerHTML = html;
  }

  renderTracks() {
    const tracksContainer = this.container.querySelector('#gantt-tracks-container');
    if (!tracksContainer) return;

    tracksContainer.innerHTML = '';
    const stations = this.getFilteredStations();

    for (const gs of stations) {
      const trackEl = document.createElement('div');
      trackEl.className = 'gantt-station-track';

      let isISRO = gs.id === 'GS-BLR' || gs.id === 'GS-LKO' || gs.id === 'GS-IXZ';
      let tagLabel = isISRO ? 'ISRO ISTRAC' : 'POLAR GATEWAY';
      let flagIcon = isISRO ? '🇮🇳' : (gs.id === 'GS-SVB' ? '🇳🇴' : (gs.id === 'GS-INU' ? '🇨🇦' : '🌐'));

      // Left Pod Header (230px wide)
      const headerEl = document.createElement('div');
      headerEl.className = 'track-label-col';
      headerEl.innerHTML = `
        <div class="station-pod" style="border-left-color: ${gs.color || '#00f0ff'};">
          <div class="station-pod-top">
            <span class="station-flag">${flagIcon}</span>
            <span class="station-code font-mono font-bold" style="color: ${gs.color || '#00f0ff'}">${gs.id}</span>
            <span class="station-agency-badge font-mono">${tagLabel}</span>
          </div>
          <div class="station-name-text">${gs.name}</div>
          <div class="station-telemetry-meta font-mono text-dim">
            <span>ω: ${gs.slewRateDegPerSec}°/s</span>
            <span>θ_min: ${gs.minElevationDeg}°</span>
            <span>X-BAND</span>
          </div>
        </div>
      `;
      trackEl.appendChild(headerEl);

      // Timeline Body
      const timelineEl = document.createElement('div');
      timelineEl.className = 'track-timeline-body';
      timelineEl.dataset.stationId = gs.id;

      // Vertical guide lines every 2 hours
      const hours = this.horizonSec / 3600;
      for (let h = 2; h < hours; h += 2) {
        const leftPct = (h / hours) * 100;
        const gridLine = document.createElement('div');
        gridLine.className = 'track-grid-hour-line';
        gridLine.style.left = `${leftPct}%`;
        timelineEl.appendChild(gridLine);
      }

      this.populateTrackPasses(timelineEl, gs);

      trackEl.appendChild(timelineEl);
      tracksContainer.appendChild(trackEl);
    }
  }

  populateTrackPasses(timelineEl, groundStation) {
    const stId = groundStation.id;

    if (this.viewMode === 'OPTIMIZED' && this.optimizedResult) {
      const passes = this.optimizedResult.scheduled.filter(p => p.stationId === stId);
      this.renderPassList(timelineEl, passes, false);
      this.renderSlewTransitions(timelineEl, passes, groundStation);
    } else if (this.viewMode === 'FCFS' && this.fcfsResult) {
      const scheduled = this.fcfsResult.scheduled.filter(p => p.stationId === stId);
      const dropped = this.fcfsResult.rejected.filter(p => p.stationId === stId);
      this.renderPassList(timelineEl, scheduled, false);
      this.renderPassList(timelineEl, dropped, true);
      this.renderSlewTransitions(timelineEl, scheduled, groundStation);
    } else if (this.viewMode === 'DIFF_OVERLAY' && this.optimizedResult && this.fcfsResult) {
      const optScheduled = this.optimizedResult.scheduled.filter(p => p.stationId === stId);
      const fcfsDropped = this.fcfsResult.rejected.filter(p => p.stationId === stId);

      this.renderPassList(timelineEl, optScheduled, false, fcfsDropped);
      this.renderSlewTransitions(timelineEl, optScheduled, groundStation);
    }
  }

  renderPassList(timelineEl, passes, isDropped = false, diffDroppedList = []) {
    const droppedIds = new Set(diffDroppedList.map(d => d.id));

    passes.forEach(p => {
      const leftPct = (p.startSec / this.horizonSec) * 100;
      const widthPct = Math.max(0.75, (p.durationSec / this.horizonSec) * 100);

      const passBlock = document.createElement('div');
      passBlock.className = `gantt-telemetry-capsule priority-${p.priority.toLowerCase()} ${isDropped ? 'pass-dropped' : ''}`;

      const isSalvaged = !isDropped && droppedIds.has(p.id);
      if (isSalvaged) {
        passBlock.classList.add('pass-salvaged-diff');
      }

      passBlock.style.left = `${leftPct}%`;
      passBlock.style.width = `${widthPct}%`;

      const dataLabel = p.actualDataGB ? `${p.actualDataGB}GB` : `${p.durationSec}s`;

      passBlock.innerHTML = `
        <div class="capsule-inner">
          <div class="capsule-header">
            <span class="capsule-wave">∿</span>
            <span class="capsule-sat font-mono font-bold">${p.satName}</span>
          </div>
          <div class="capsule-meta">
            <span class="capsule-pill font-mono">${dataLabel}</span>
            <span class="capsule-pill font-mono">${p.peakElDeg ? p.peakElDeg + '°' : ''}</span>
            ${isSalvaged ? '<span class="diff-salvage-tag">RESCUED</span>' : ''}
          </div>
        </div>
      `;

      passBlock.addEventListener('mouseenter', (e) => this.showTooltip(e, p, isDropped, isSalvaged));
      passBlock.addEventListener('mouseleave', () => this.hideTooltip());
      passBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedPassId = p.id;
        if (this.onPassClick) this.onPassClick(p);
        if (this.onSeek) this.onSeek(p.startSec);
      });

      timelineEl.appendChild(passBlock);
    });
  }

  renderSlewTransitions(timelineEl, passes, groundStation) {
    const sorted = [...passes].sort((a, b) => a.startSec - b.startSec);

    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];

      const gapSec = next.startSec - cur.endSec;
      if (gapSec <= 0) continue;

      const leftPct = (cur.endSec / this.horizonSec) * 100;
      const widthPct = (gapSec / this.horizonSec) * 100;

      if (widthPct > 0.3) {
        const slewBlock = document.createElement('div');
        slewBlock.className = 'gantt-slew-zone';
        slewBlock.style.left = `${leftPct}%`;
        slewBlock.style.width = `${widthPct}%`;

        if (cur.nextSlewDetails) {
          slewBlock.innerHTML = `<span class="slew-zone-tag">↺ ${cur.nextSlewDetails.angularDistDeg}°</span>`;
          slewBlock.title = `Slew: ${cur.nextSlewDetails.angularDistDeg}° in ${cur.nextSlewDetails.totalRequiredSec}s (Margin: +${cur.nextSlewDetails.marginSec}s)`;
        }

        timelineEl.appendChild(slewBlock);
      }
    }
  }

  showTooltip(event, pass, isDropped = false, isSalvaged = false) {
    const tooltip = this.container.querySelector('#gantt-tooltip');
    if (!tooltip) return;

    const startH = formatSecToUTC(pass.startSec);
    const endH = formatSecToUTC(pass.endSec);

    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-badge priority-${pass.priority.toLowerCase()}">${pass.priority}</span>
        <span class="tooltip-id font-mono">${pass.id}</span>
      </div>
      <div class="tooltip-title">${pass.satName} <span class="text-dim">(${pass.satType || 'Earth Observation'})</span></div>
      <div class="tooltip-station">Ground Station: <strong>${pass.stationName}</strong></div>
      
      <div class="tooltip-grid">
        <div class="t-item"><span class="t-k">Contact Window:</span><span class="t-v font-mono">${startH} - ${endH}</span></div>
        <div class="t-item"><span class="t-k">Duration:</span><span class="t-v font-mono">${pass.durationSec}s</span></div>
        <div class="t-item"><span class="t-k">Peak Elevation:</span><span class="t-v font-mono">${pass.peakElDeg}°</span></div>
        <div class="t-item"><span class="t-k">Channel Bitrate:</span><span class="t-v font-mono">${pass.dataRateMbps} Mbps</span></div>
        <div class="t-item"><span class="t-k">Downlinked Payload:</span><span class="t-v font-mono font-bold text-emerald">${pass.actualDataGB || pass.potentialDataGB} GB</span></div>
        <div class="t-item"><span class="t-k">Priority Multiplier:</span><span class="t-v font-mono">${pass.priorityWeight}x</span></div>
      </div>

      ${isDropped ? `
        <div class="tooltip-conflict-box">
          <div class="conflict-title">⚠️ FCFS CONFLICT REJECTION</div>
          <div class="conflict-desc">${pass.reason || 'Slew transition overlap with higher satellite pass'}</div>
          <div class="conflict-sub text-dim">${pass.conflictDetails || ''}</div>
        </div>
      ` : ''}

      ${isSalvaged ? `
        <div class="tooltip-salvage-box">
          <div class="salvage-title">✨ RESCUED BY AUTONOMOUS SOLVER</div>
          <div class="salvage-desc">Optimal slew maneuver scheduling eliminated baseline rejection!</div>
        </div>
      ` : ''}

      ${pass.nextSlewDetails ? `
        <div class="tooltip-slew-box">
          <div class="slew-title">Antenna Repointing to ${pass.nextSlewDetails.targetSatName}:</div>
          <div class="slew-sub font-mono">Δθ: ${pass.nextSlewDetails.angularDistDeg}° | Slew+Settle: ${pass.nextSlewDetails.totalRequiredSec}s | Gap: ${pass.nextSlewDetails.availableGapSec}s</div>
          <div class="slew-margin font-mono font-bold ${pass.nextSlewDetails.isFeasible ? 'text-emerald' : 'text-coral'}">
            Safety Margin: ${pass.nextSlewDetails.marginSec >= 0 ? '+' : ''}${pass.nextSlewDetails.marginSec}s (${pass.nextSlewDetails.isFeasible ? 'SAFE' : 'INFEASIBLE'})
          </div>
        </div>
      ` : ''}
    `;

    tooltip.style.display = 'block';
    const x = Math.min(window.innerWidth - 340, event.clientX + 16);
    const y = Math.min(window.innerHeight - 300, event.clientY + 16);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  hideTooltip() {
    const tooltip = this.container.querySelector('#gantt-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  updateScrubber(currentSec) {
    this.currentSec = currentSec;
    const scrubberLine = this.container.querySelector('#gantt-scrubber-line');
    const scrubberLabel = this.container.querySelector('#gantt-scrubber-label');
    if (!scrubberLine) return;

    const fraction = Math.max(0, Math.min(1, currentSec / this.horizonSec));
    const viewport = this.container.querySelector('#gantt-viewport');
    if (viewport) {
      const width = viewport.clientWidth - 230;
      const leftPx = 230 + fraction * width;
      scrubberLine.style.left = `${leftPx}px`;
    }

    if (scrubberLabel) {
      scrubberLabel.textContent = formatSecToUTC(currentSec);
    }
  }
}

function formatSecToUTC(sec) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
}
