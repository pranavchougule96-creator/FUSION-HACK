/**
 * SPACE-04: Git Push to GitHub Utility
 * Pure Node.js script using isomorphic-git to push the repository to any GitHub URL.
 * Usage:
 *   node scripts/git-push.js <remote-url> [github-token]
 */

import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  let repoUrl = process.argv[2] || process.env.GITHUB_REPO_URL;
  let token = process.argv[3] || process.env.GITHUB_TOKEN;

  console.log('=======================================================');
  console.log('🛰️ SPACE-04: GitHub Push Utility (isomorphic-git)');
  console.log('=======================================================');

  if (!repoUrl) {
    repoUrl = await askQuestion('Enter your GitHub Repository URL\n(e.g. https://github.com/pranavchougule96/SPACE-04.git):\n> ');
  }

  if (!repoUrl) {
    console.error('❌ Error: Repository URL is required.');
    process.exit(1);
  }

  if (!token) {
    token = await askQuestion('\nEnter your GitHub Personal Access Token (PAT)\n(Get one from https://github.com/settings/tokens):\n> ');
  }

  // Ensure remote origin is set
  try {
    const remotes = await git.listRemotes({ fs, dir: rootDir });
    const hasOrigin = remotes.some(r => r.remote === 'origin');
    if (!hasOrigin) {
      await git.addRemote({ fs, dir: rootDir, remote: 'origin', url: repoUrl });
      console.log(`✓ Added remote 'origin': ${repoUrl}`);
    } else {
      await git.deleteRemote({ fs, dir: rootDir, remote: 'origin' });
      await git.addRemote({ fs, dir: rootDir, remote: 'origin', url: repoUrl });
      console.log(`✓ Updated remote 'origin': ${repoUrl}`);
    }
  } catch (err) {
    console.log('Remote note:', err.message);
  }

  console.log(`\nPushing branch 'main' to ${repoUrl}...`);

  try {
    const pushResult = await git.push({
      fs,
      http,
      dir: rootDir,
      remote: 'origin',
      ref: 'main',
      force: true,
      onAuth: () => ({
        username: token || 'git',
        password: token || ''
      })
    });

    console.log('\n=======================================================');
    console.log('🎉 Successfully pushed repository to GitHub!');
    console.log(`Repository: ${repoUrl}`);
    console.log('=======================================================');
  } catch (err) {
    console.error('\n❌ Push failed:', err.message);
    if (err.data && err.data.response) {
      console.error('GitHub response:', err.data.response);
    }
    console.log('\nTroubleshooting tip: Ensure your Personal Access Token has "repo" scope enabled.');
    process.exit(1);
  }
}

main();
