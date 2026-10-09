/**
 * SPACE-04: Git Repository Initializer & Committer
 * Pure Node.js Git engine using isomorphic-git to initialize .git, stage files, and commit.
 */

import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function initAndCommit() {
  console.log('1. Initializing Git repository in:', rootDir);
  await git.init({ fs, dir: rootDir, defaultBranch: 'main' });

  console.log('2. Staging all project files...');
  // List files recursively, ignoring node_modules, .vercel, and dist/bundle*
  const ignoreList = ['node_modules', '.vercel', '.git', 'dist'];

  function getAllFiles(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (ignoreList.some(ig => relPath.startsWith(ig) || relPath === ig)) {
        continue;
      }

      if (entry.isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else {
        fileList.push(relPath);
      }
    }
    return fileList;
  }

  const filesToStage = getAllFiles(rootDir);
  console.log(`   Found ${filesToStage.length} files to stage.`);

  for (const file of filesToStage) {
    await git.add({ fs, dir: rootDir, filepath: file });
  }

  console.log('3. Creating Initial Commit...');
  const sha = await git.commit({
    fs,
    dir: rootDir,
    author: {
      name: 'Pranav Chougule',
      email: 'pranavchougule96@gmail.com'
    },
    message: 'Initial commit: SPACE-04 Autonomous Ground Station Scheduling Dashboard with Indian Network & CelesTrak TLE integration'
  });

  console.log(`✅ Git commit created successfully! Commit SHA: ${sha}`);
  console.log(`   Branch: main`);
}

initAndCommit().catch(err => {
  console.error('Git error:', err);
  process.exit(1);
});
