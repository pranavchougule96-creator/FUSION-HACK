/**
 * SPACE-04: Standalone Single-File HTML Builder
 * Inlines all JavaScript (minified IIFE) and CSS into a completely self-contained index.html
 * that runs natively when opened directly via file:// in any browser without CORS restrictions.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('1. Building minified IIFE bundle with esbuild...');
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Bundle src/main.js into dist/bundle.min.js and dist/bundle.min.css
execSync('npx esbuild src/main.js --bundle --minify --format=iife --outfile=dist/bundle.min.js', {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log('2. Reading compiled JS and CSS bundles...');
const jsCode = fs.readFileSync(path.join(distDir, 'bundle.min.js'), 'utf-8');
const cssCode = fs.readFileSync(path.join(distDir, 'bundle.min.css'), 'utf-8');

console.log('3. Generating standalone single-file HTML...');
const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SPACE-04: Autonomous Ground Station Scheduling for Multi-Satellite Downlink. Planet Labs constellation challenge dashboard featuring 3D globe, Slew-Constrained ILP optimization, attitude telemetry, and multi-track Gantt scheduling." />
    <meta name="theme-color" content="#030712" />
    <title>SPACE-04: Autonomous Ground Station Scheduling | Planet Labs Constellation Mission Control</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛰️</text></svg>" />
    <style>
${cssCode}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${jsCode}
    </script>
  </body>
</html>`;

// Write to dist/index.html and dist/standalone.html
fs.writeFileSync(path.join(distDir, 'index.html'), htmlTemplate, 'utf-8');
fs.writeFileSync(path.join(distDir, 'standalone.html'), htmlTemplate, 'utf-8');

// Also update the root index.html so double-clicking index.html directly from Windows Explorer works instantly!
fs.writeFileSync(path.join(rootDir, 'index.html'), htmlTemplate, 'utf-8');
fs.writeFileSync(path.join(rootDir, 'standalone.html'), htmlTemplate, 'utf-8');

// Ensure public textures and data are copied to dist
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
}

console.log('✅ Standalone single-file HTML created successfully:');
console.log('   - ' + path.join(rootDir, 'index.html'));
console.log('   - ' + path.join(rootDir, 'standalone.html'));
console.log('   - ' + path.join(distDir, 'index.html'));
