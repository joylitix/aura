import esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function copyDaemon() {
  const src = path.join(root, '../agent-daemon/dist/daemon.mjs');
  const dest = path.join(root, 'bundled', 'daemon.mjs');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

const buildOpts = {
  entryPoints: [path.join(root, 'src/extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(root, 'out/extension.js'),
  external: ['vscode'],
  sourcemap: true,
  target: 'node20',
};

await esbuild.build(buildOpts);
await copyDaemon();
