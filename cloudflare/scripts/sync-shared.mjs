import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonical = path.resolve(base, '../src');
const target = path.join(base, 'shared');
const names = ['core.mjs', 'generated-prompt.mjs'];
const hash = data => createHash('sha256').update(data).digest('hex');
const checking = process.argv.includes('--check');
if (checking) {
  const manifest = JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8'));
  for (const name of names) {
    const copy = await readFile(path.join(target, name));
    if (hash(copy) !== manifest.files[name]) throw new Error(`Generated shared file changed: ${name}`);
    let source;
    try { source = await readFile(path.join(canonical, name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (source && !source.equals(copy)) throw new Error(`Canonical source changed; run npm run sync-shared: ${name}`);
  }
  console.log('Shared source hashes verified.');
} else {
  const manifest = { note: 'Generated from the repository src/ files. Do not edit copies by hand.', files: {} };
  await mkdir(target, { recursive: true });
  for (const name of names) {
    const data = await readFile(path.join(canonical, name));
    await writeFile(path.join(target, name), data);
    manifest.files[name] = hash(data);
  }
  await writeFile(path.join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Copied canonical shared source.');
}
