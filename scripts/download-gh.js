/**
 * Download portable GitHub CLI (gh.exe) without requiring administrator/winget privileges.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const binDir = path.join(rootDir, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const ghExe = path.join(binDir, 'gh.exe');
if (fs.existsSync(ghExe)) {
  console.log('✓ gh.exe already exists at:', ghExe);
  process.exit(0);
}

const zipUrl = 'https://github.com/cli/cli/releases/download/v2.67.0/gh_2.67.0_windows_amd64.zip';
const zipPath = path.join(binDir, 'gh.zip');

console.log('Downloading GitHub CLI (gh) from:', zipUrl);

function download(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, response => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      // Follow redirect
      return download(response.headers.location, dest, cb);
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close(cb);
    });
  }).on('error', err => {
    fs.unlink(dest, () => {});
    console.error('Download error:', err.message);
    process.exit(1);
  });
}

download(zipUrl, zipPath, () => {
  console.log('✓ Download complete. Extracting gh.exe with PowerShell...');
  try {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`, {
      stdio: 'inherit'
    });
    // Find gh.exe in extracted folder and move to bin/gh.exe
    const extractedDir = path.join(binDir, 'gh_2.67.0_windows_amd64', 'bin');
    const sourceExe = path.join(extractedDir, 'gh.exe');
    if (fs.existsSync(sourceExe)) {
      fs.copyFileSync(sourceExe, ghExe);
      console.log('✅ gh.exe successfully installed to:', ghExe);
    }
    // Cleanup zip
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch (err) {
    console.error('Extraction error:', err);
    process.exit(1);
  }
});
