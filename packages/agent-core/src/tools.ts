import fs from 'node:fs/promises';
import path from 'node:path';
import { matchSimpleGlob } from './simpleGlob.js';
import { resolveSafePath, SandboxError } from './sandbox.js';

export interface ToolContext {
  workspaceRoot: string;
  maxReadBytes: number;
  maxGlobFiles: number;
  maxGrepFileBytes: number;
}

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    name: 'read_file',
    description: 'Read a UTF-8 text file relative to the workspace root.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to workspace' },
      },
      required: ['path'],
    },
  },
  {
    type: 'function' as const,
    name: 'glob_file_search',
    description: 'List files matching a glob pattern under the workspace.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' },
      },
      required: ['pattern'],
    },
  },
  {
    type: 'function' as const,
    name: 'grep',
    description:
      'Search for a regular expression in text files under the workspace (simple recursive scan, capped).',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'ECMAScript regex (no flags)' },
        path: {
          type: 'string',
          description: 'Optional subdirectory (relative) to limit search',
        },
      },
      required: ['pattern'],
    },
  },
];

export async function invokeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'read_file':
      return readFileTool(ctx, String(args.path ?? ''));
    case 'glob_file_search':
      return globFileSearchTool(ctx, String(args.pattern ?? ''));
    case 'grep':
      return grepTool(
        ctx,
        String(args.pattern ?? ''),
        args.path !== undefined ? String(args.path) : undefined
      );
    default:
      return `unknown tool: ${name}`;
  }
}

async function readFileTool(ctx: ToolContext, rel: string): Promise<string> {
  const safe = await resolveSafePath(ctx.workspaceRoot, rel);
  const buf = await fs.readFile(safe);
  const sliced = buf.subarray(0, ctx.maxReadBytes);
  const text = sliced.toString('utf8');
  if (buf.length > ctx.maxReadBytes) {
    return `${text}\n… [truncated after ${ctx.maxReadBytes} bytes]`;
  }
  return text;
}

async function globFileSearchTool(ctx: ToolContext, pattern: string): Promise<string> {
  if (!pattern) throw new SandboxError('empty glob pattern');
  const base = ctx.workspaceRoot;
  const { matches, truncated } = await collectGlobMatches(
    base,
    pattern,
    ctx.maxGlobFiles,
    50_000
  );
  const extra = truncated ? `\n… (hit file scan or result cap)` : '';
  return matches.join('\n') + extra;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next', 'coverage']);

async function collectGlobMatches(
  root: string,
  pattern: string,
  maxMatches: number,
  maxFilesScanned: number
): Promise<{ matches: string[]; truncated: boolean }> {
  const matches: string[] = [];
  let scanned = 0;
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (matches.length >= maxMatches || scanned >= maxFilesScanned) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (matches.length >= maxMatches || scanned >= maxFilesScanned) {
        truncated = true;
        break;
      }
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        await walk(full);
      } else if (ent.isFile()) {
        scanned++;
        const rel = path.relative(root, full).replace(/\\/g, '/');
        if (rel && !rel.startsWith('..') && matchSimpleGlob(rel, pattern)) {
          matches.push(rel);
        }
      }
    }
  }

  await walk(root);
  return { matches, truncated };
}

async function grepTool(
  ctx: ToolContext,
  pattern: string,
  subdir?: string
): Promise<string> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return 'invalid regex pattern';
  }

  const searchRoot = subdir
    ? await resolveSafePath(ctx.workspaceRoot, subdir)
    : ctx.workspaceRoot;

  const results: string[] = [];
  const maxLines = 200;

  async function walk(dir: string): Promise<void> {
    if (results.length >= maxLines) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (results.length >= maxLines) break;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        await walk(full);
      } else if (ent.isFile()) {
        let st;
        try {
          st = await fs.stat(full);
        } catch {
          continue;
        }
        if (st.size > ctx.maxGrepFileBytes) continue;
        let content: string;
        try {
          content = await fs.readFile(full, 'utf8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (results.length >= maxLines) return;
          if (regex.test(line)) {
            const rel = path.relative(ctx.workspaceRoot, full);
            results.push(`${rel}:${i + 1}:${line}`);
          }
        });
      }
    }
  }

  await walk(searchRoot);
  if (results.length === 0) return 'no matches';
  return results.join('\n');
}
