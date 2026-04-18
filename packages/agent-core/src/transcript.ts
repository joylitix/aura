import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface TranscriptLine {
  t: string;
  kind: string;
  data: unknown;
}

export function transcriptPath(workspaceId: string, threadId: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = path.join(os.tmpdir(), 'aura', 'transcripts');
  return path.join(dir, `${safe(workspaceId)}-${safe(threadId)}.jsonl`);
}

export async function appendTranscript(
  workspaceId: string,
  threadId: string,
  line: TranscriptLine
): Promise<void> {
  const p = transcriptPath(workspaceId, threadId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, `${JSON.stringify(line)}\n`, 'utf8');
}
