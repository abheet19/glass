#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formatOnly = process.argv.includes('--format');
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.yml']);
const ignored = new Set(['node_modules', '.git', '.frames']);

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (textExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const files = await collect(root);
const failures = [];
for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const source = await readFile(file, 'utf8');
  if (!source.endsWith('\n')) failures.push(`${relative}: missing final newline`);
  source.split(/\r?\n/).forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
  });
  if (path.extname(file) === '.json') {
    try {
      const parsed = JSON.parse(source);
      const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
      if (source.replaceAll('\r\n', '\n') !== formatted) failures.push(`${relative}: JSON is not canonical two-space format`);
    } catch (error) {
      failures.push(`${relative}: invalid JSON (${error.message})`);
    }
  }
}

if (!formatOnly) {
  for (const file of files.filter(file => ['.js', '.mjs'].includes(path.extname(file)))) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (checked.status !== 0) failures.push(`${path.relative(root, file)}: ${checked.stderr.trim() || 'syntax check failed'}`);
  }
  for (const file of files.filter(file => path.extname(file) === '.css')) {
    const source = await readFile(file, 'utf8');
    const balance = [...source].reduce((count, character) => count + (character === '{' ? 1 : character === '}' ? -1 : 0), 0);
    if (balance !== 0) failures.push(`${path.relative(root, file)}: unbalanced braces (${balance})`);
    for (const match of source.matchAll(/@import\s+["']([^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      try { await readFile(target); } catch { failures.push(`${path.relative(root, file)}: missing import ${match[1]}`); }
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`PASS — ${formatOnly ? 'format hygiene' : 'source lint'} across ${files.length} text files.`);
