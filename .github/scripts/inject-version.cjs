#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node inject-version.cjs <source.html> <destination.html>');
const input = fs.readFileSync(path.resolve(source), 'utf8');
const token = '__STEPUP_VERSION__';
const count = input.split(token).length - 1;
if (count !== 2) throw new Error('Expected exactly two version placeholders in the application HTML, found ' + count);
fs.mkdirSync(path.dirname(path.resolve(destination)), {recursive:true});
fs.writeFileSync(path.resolve(destination), input.replaceAll(token, config.version), 'utf8');
