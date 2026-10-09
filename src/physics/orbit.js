/**
 * SPACE-04: Orbital Mechanics & Ephemeris Propagation
 * High-performance Keplerian & J2 Perturbation (SSO & Walker Delta) Orbit Propagator
 */

import { EARTH_RADIUS_KM } from './groundStations.js';

export const MU_EARTH = 398600.4418; // km^3 / s^2 (Earth gravitational parameter)
export const J2_EARTH = 1.08262668e-3; // Earth oblateness harmonic
export const OMEGA_EARTH = 7.292115e-5; // rad/s (Earth sidereal rotation rate)

/**
 * Propagates Keplerian elements with J2 secular nodal drift to ECEF and Geodetic coords.
 */
export class OrbitPropagator {
  constructor({
    semiMajorAxisKm = 6878.137, // ~500 km altitude
    eccentricity = 0.0012,       // Near-circular LEO
    inclinationDeg = 97.4,       // Sun-synchronous inclination
    raanDeg = 0.0,              // Right Ascension of Ascending Node
    argPerigeeDeg = 0.0,         // Argument of Perigee
    meanAnomalyDeg = 0.0,        // Initial Mean Anomaly
    epochTimeSec = 0             // Initial epoch
  }) {
    this.a = semiMajorAxisKm;
    this.e = Math.max(0.0001, eccentricity);
    this.incRad = (inclinationDeg * Math.PI) / 180;
    this.raanRad0 = (raanDeg * Math.PI) / 180;
    this.argPerigeeRad = (argPerigeeDeg * Math.PI) / 180;
    this.meanAnomalyRad0 = (meanAnomalyDeg * Math.PI) / 180;
    this.epoch = epochTimeSec;

    // Mean motion n = sqrt(mu / a^3) rad/s
    this.n = Math.sqrt(MU_EARTH / Math.pow(this.a, 3));
    this.periodSec = (2 * Math.PI) / this.n;

    // Semi-latus rectum p = a * (1 - e^2)
    const p = this.a * (1 - this.e * this.e);

    // J2 RAAN nodal precession rate: dOmega/dt = -1.5 * J2 * (R_E / p)^2 * n * cos(i)
    this.raanPrecessionRate = -1.5 * J2_EARTH * Math.pow(EARTH_RADIUS_KM / p, 2) * this.n * Math.cos(this.incRad);
  }

  /**
   * Solve Kepler's equation for Eccentric Anomaly E given Mean Anomaly M:
   * M = E - e * sin(E) using Newton-Raphson iteration.
   */
  solveKepler(M) {
    let E = M;
    for (let i = 0; i < 7; i++) {
      const dE = (E - this.e * Math.sin(E) - M) / (1 - this.e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-7) break;
    }
    return E;
  }

  /**
   * Propagates satellite state at time t (seconds from epoch).
   * Returns:
   * {
   *   eciPos: [x, y, z] km,
   *   ecefPos: [x, y, z] km,
   *   latDeg, lonDeg, altKm,
   *   velocityKmS,
   *   trueAnomalyDeg
   * }
   */
  propagate(tSec) {
    const dt = tSec - this.epoch;
    
    // Mean anomaly
    let M = (this.meanAnomalyRad0 + this.n * dt) % (2 * Math.PI);
    if (M < 0) M += 2 * Math.PI;

    // Eccentric anomaly
    const E = this.solveKepler(M);

    // True anomaly nu
    const sinNu = (Math.sqrt(1 - this.e * this.e) * Math.sin(E)) / (1 - this.e * Math.cos(E));
    const cosNu = (Math.cos(E) - this.e) / (1 - this.e * Math.cos(E));
    const nu = Math.atan2(sinNu, cosNu);

    // Orbital radius
    const r = (this.a * (1 - this.e * this.e)) / (1 + this.e * Math.cos(nu));

    // Position in orbital plane
    const xOrb = r * Math.cos(nu + this.argPerigeeRad);
    const yOrb = r * Math.sin(nu + this.argPerigeeRad);

    // Current RAAN with J2 precession
    const currentRaan = this.raanRad0 + this.raanPrecessionRate * dt;

    // Transform Orbital plane -> ECI (Earth-Centered Inertial)
    const cosRaan = Math.cos(currentRaan);
    const sinRaan = Math.sin(currentRaan);
    const cosInc = Math.cos(this.incRad);
    const sinInc = Math.sin(this.incRad);

    const xECI = cosRaan * xOrb - sinRaan * cosInc * yOrb;
    const yECI = sinRaan * xOrb + cosRaan * cosInc * yOrb;
    const zECI = sinInc * yOrb;

    // GMST (Greenwich Mean Sidereal Time) rotation theta_G
    const thetaG = (OMEGA_EARTH * dt) % (2 * Math.PI);

    // ECI -> ECEF (Earth-Centered Earth-Fixed) via rotation about Z
    const cosG = Math.cos(thetaG);
    const sinG = Math.sin(thetaG);

    const xECEF = cosG * xECI + sinG * yECI;
    const yECEF = -sinG * xECI + cosG * yECI;
    const zECEF = zECI;

    // Geodetic sub-satellite coordinates
    const rXY = Math.sqrt(xECEF * xECEF + yECEF * yECEF);
    const latRad = Math.atan2(zECEF, rXY);
    const lonRad = Math.atan2(yECEF, xECEF);

    const latDeg = (latRad * 180) / Math.PI;
    const lonDeg = (lonRad * 180) / Math.PI;
    const altKm = r - EARTH_RADIUS_KM;

    // Orbital speed magnitude (Vis-Viva equation)
    const velocityKmS = Math.sqrt(MU_EARTH * (2 / r - 1 / this.a));

    return {
      eciPos: [xECI, yECI, zECI],
      ecefPos: [xECEF, yECEF, zECEF],
      latDeg,
      lonDeg,
      lat: latDeg,
      lon: lonDeg,
      altKm,
      velocityKmS,
      trueAnomalyDeg: (nu * 180) / Math.PI,
      radiusKm: r
    };
  }

  /**
   * Sample ground track points for orbital trajectory visualization.
   */
  generateGroundTrack(tCurrentSec, durationSec = 5600, stepSec = 60) {
    const points = [];
    for (let t = tCurrentSec; t <= tCurrentSec + durationSec; t += stepSec) {
      const state = this.propagate(t);
      points.push({
        t,
        lat: state.latDeg,
        lon: state.lonDeg,
        alt: state.altKm,
        ecef: state.ecefPos
      });
    }
    return points;
  }
}
