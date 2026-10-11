import {readdir, readFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['node_modules', '.git', '.wrangler', 'dist', '__pycache__']);
const deniedNames = /^(\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/;
const examples = new Set(['.env.example', '.dev.vars.example']);
const signatures = [
  /sk-or-v1-[a-zA-Z0-9]{20,}/,
  /(?:ghp_|github_pat_)[a-zA-Z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:libfile_|task)[0-9a-f]{24,}/,
  /https:\/\/[^/\s]+\.chatgpt\.site\b/,
  /skill-[0-9a-f]{32}/,
];
let files = 0, failed = false;
async function visit(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name), name = relative(root, path);
    if (entry.isDirectory()) { await visit(path); continue; }
    if (!entry.isFile()) { console.error(`Unexpected non-file: ${name}`); failed = true; continue; }
    if (deniedNames.test(entry.name) && !examples.has(entry.name)) { console.error(`Private environment file present: ${name}`); failed = true; }
    const text = await readFile(path, 'utf8'); files++;
    if (signatures.some(pattern => pattern.test(text))) { console.error(`Potential secret/private deployment reference: ${name}`); failed = true; }
  }
}
await visit(root);
if (failed) process.exitCode = 1;
else console.log(`Public-package heuristic scan passed across ${files} files. Manual review is still required.`);
