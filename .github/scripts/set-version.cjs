#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(config.version) || !Number.isInteger(config.androidVersionCode) || config.androidVersionCode < 1) {
  throw new Error('version.json must contain a semantic version and a positive Android version code');
}
console.log('STEPUP_VERSION=' + config.version);
console.log('STEPUP_ANDROID_VERSION_CODE=' + config.androidVersionCode);
