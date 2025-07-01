// Enhanced debug script for Codecov CLI issues
const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

console.log('===== Repository Debug Info =====');
console.log('Current directory:', process.cwd());

// Try to read package.json
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  console.log('\nPackage.json repository field:', packageJson.repository || 'Not set');
  console.log('Package.json name:', packageJson.name);
} catch (e) {
  console.error('Error reading package.json:', e.message);
}

// Output git info
console.log('\n===== Git Config Info =====');
console.log('Environment variables:');
Object.keys(process.env)
  .filter(key => key.includes('GIT') || key.includes('GITHUB') || key.includes('CODECOV') || key.includes('REPO'))
  .forEach(key => {
    console.log(`${key}=${process.env[key]}`);
  });

// Check the coverage file
const coveragePath = path.join(process.cwd(), 'coverage', 'lcov.info');
console.log('\n===== Coverage File Info =====');
console.log(`Looking for coverage file: ${coveragePath}`);

if (fs.existsSync(coveragePath)) {
  const stats = fs.statSync(coveragePath);
  console.log(`File exists: Yes, size: ${stats.size} bytes`);
  
  if (stats.size > 0) {
    const content = fs.readFileSync(coveragePath, 'utf8');
    console.log(`First 100 characters: \n${content.substring(0, 100)}...`);
  }
} else {
  console.log('File exists: No');
}

// Check Git remote info
try {
  console.log('\n===== Git Remote Info =====');
  const remotes = execSync('git remote -v').toString();
  console.log(remotes);
  
  console.log('\n===== Git Branch Info =====');
  const branch = execSync('git branch --show-current').toString();
  console.log(`Current branch: ${branch}`);
  
  console.log('\n===== Latest Commit =====');
  const commit = execSync('git log -n 1 --oneline').toString();
  console.log(commit);
} catch (e) {
  console.error('Error running Git commands:', e.message);
}

// Write debug info to file
const debugInfo = {
  env: Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.includes('GIT') || key.includes('GITHUB') || key.includes('CODECOV') || key.includes('REPO'))
  ),
  timestamp: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version
};

console.log('\nWriting debug info to debug-output.json');
fs.writeFileSync(
  path.join(process.cwd(), 'debug-output.json'), 
  JSON.stringify(debugInfo, null, 2)
);
