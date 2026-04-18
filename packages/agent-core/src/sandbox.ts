import path from 'node:path';
import { realpath } from 'node:fs/promises';

/**
 * Resolve a user-provided path (relative to workspace or absolute) to a real path
 * and ensure it stays under workspaceRoot (after realpath, symlink-safe).
 */
export async function resolveSafePath(workspaceRoot: string, userPath: string): Promise<string> {
  const rootReal = await realpath(workspaceRoot);
  const joined = path.isAbsolute(userPath)
    ? userPath
    : path.resolve(rootReal, userPath);

  let targetReal: string;
  try {
    targetReal = await realpath(joined);
  } catch {
    targetReal = path.normalize(joined);
  }

  const rel = path.relative(rootReal, targetReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new SandboxError(`path escapes workspace: ${userPath}`);
  }
  return targetReal;
}

export class SandboxError extends Error {
  readonly code = 'SANDBOX' as const;
  override name = 'SandboxError';
}
