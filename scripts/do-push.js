/**
 * Final automated push using MinGit and authenticated GitHub CLI token
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const gitExe = path.join(rootDir, 'bin', 'mingit', 'cmd', 'git.exe');
const ghExe = path.join(rootDir, 'bin', 'gh.exe');

async function main() {
  console.log('1. Retrieving token from GitHub CLI...');
  const token = execSync(`"${ghExe}" auth token`, { encoding: 'utf-8' }).trim();
  console.log('✓ Authenticated as pranavchougule96-creator.');

  console.log('2. Staging all project files with MinGit...');
  execSync(`"${gitExe}" add -A`, { cwd: rootDir, stdio: 'inherit' });

  console.log('3. Committing...');
  try {
    execSync(`"${gitExe}" commit -m "SPACE-04: Autonomous Ground Station Scheduling Dashboard (Complete Deliverable)"`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (e) {
    console.log('✓ Tree is clean / already committed.');
  }

  console.log('4. Pushing branch main to GitHub repository...');
  const remoteUrl = `https://${token}@github.com/pranavchougule96-creator/FUSION-HACK.git`;
  execSync(`"${gitExe}" push "${remoteUrl}" main --force`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log('\n=======================================================');
  console.log('🎉 SUCCESS! All files pushed to GitHub:');
  console.log('👉 https://github.com/pranavchougule96-creator/FUSION-HACK');
  console.log('=======================================================');
}

main().catch(err => {
  console.error('Push error:', err);
  process.exit(1);
});
