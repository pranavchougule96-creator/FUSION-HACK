const { execSync } = require('child_process');

try {
  const token = execSync('.\\bin\\gh.exe auth token', { encoding: 'utf8' }).trim();
  console.log('GitHub token obtained.');

  execSync('.\\bin\\mingit\\cmd\\git.exe config user.name "pranavchougule96-creator"', { stdio: 'inherit' });
  execSync('.\\bin\\mingit\\cmd\\git.exe config user.email "pranavchougule96@gmail.com"', { stdio: 'inherit' });
  
  execSync('.\\bin\\mingit\\cmd\\git.exe add -A', { stdio: 'inherit' });
  console.log('Changes staged.');

  try {
    execSync('.\\bin\\mingit\\cmd\\git.exe commit -m "feat: realistic 3D Earth, live simulation analytics, and redesigned timetable"', { stdio: 'inherit' });
    console.log('Committed.');
  } catch (e) {
    console.log('No new commit needed or already committed.');
  }

  execSync(`.\\bin\\mingit\\cmd\\git.exe push https://${token}@github.com/pranavchougule96-creator/FUSION-HACK.git main`, { stdio: 'inherit' });
  console.log('Successfully pushed to GitHub!');
} catch (err) {
  console.error('Push failed:', err.message);
  process.exit(1);
}
