/**
 * Automated push using authenticated gh.exe token
 */

import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function push() {
  console.log('1. Reading authenticated token from GitHub CLI...');
  const token = execSync(`"${path.join(rootDir, 'bin', 'gh.exe')}" auth token`, { encoding: 'utf-8' }).trim();
  console.log('✓ Token successfully retrieved!');

  const repoUrl = 'https://github.com/pranavchougule96-creator/FUSION-HACK.git';
  console.log('2. Pushing branch main to:', repoUrl);

  // Set remote
  try {
    await git.deleteRemote({ fs, dir: rootDir, remote: 'origin' });
  } catch(e) {}
  await git.addRemote({ fs, dir: rootDir, remote: 'origin', url: repoUrl });

  const result = await git.push({
    fs,
    http,
    dir: rootDir,
    remote: 'origin',
    url: repoUrl,
    ref: 'main',
    force: true,
    onAuth: () => ({
      username: token,
      password: ''
    })
  });

  console.log('=======================================================');
  console.log('🎉 SUCCESS! Pushed to GitHub repository:');
  console.log('   https://github.com/pranavchougule96-creator/FUSION-HACK');
  console.log('=======================================================');
}

push().catch(err => {
  console.error('❌ Push error:', err);
  process.exit(1);
});
