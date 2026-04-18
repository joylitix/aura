import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSafePath, SandboxError } from './sandbox.js';

describe('resolveSafePath', () => {
  it('rejects traversal outside workspaceRoot', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-sb-'));
    const inside = path.join(tmp, 'proj');
    await fs.mkdir(inside, { recursive: true });
    await expect(resolveSafePath(inside, '../escape')).rejects.toBeInstanceOf(SandboxError);
  });

  it('allows a file under workspace', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-sb-'));
    const f = path.join(tmp, 'a.txt');
    await fs.writeFile(f, 'hi', 'utf8');
    const resolved = await resolveSafePath(tmp, 'a.txt');
    expect(resolved).toBe(await fs.realpath(f));
  });
});
