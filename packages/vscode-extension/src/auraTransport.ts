import * as readline from 'node:readline';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ClientRequest } from '@aura/protocol';

/** NDJSON line transport (stdio today; remote TCP later — issue #9). */
export interface AuraTransport {
  readonly kind: 'stdio' | 'remote';
  /** Append one NDJSON line to the daemon (must include trailing newline). */
  writeLine(line: string): void;
  /** Raw JSON request helper */
  writeRequest(req: ClientRequest): void;
  onStdoutLine(handler: (line: string) => void): void;
  offStdoutLine(handler: (line: string) => void): void;
  onStderrLine(handler: (line: string) => void): void;
  offStderrLine(handler: (line: string) => void): void;
  dispose(): void;
}

export class StdioNdjsonAuraTransport implements AuraTransport {
  readonly kind = 'stdio' as const;
  private readonly proc: ChildProcessWithoutNullStreams;
  private readonly stdoutRl: readline.Interface;
  private readonly stderrRl: readline.Interface;
  private readonly stdoutHandlers = new Set<(line: string) => void>();
  private readonly stderrHandlers = new Set<(line: string) => void>();

  constructor(proc: ChildProcessWithoutNullStreams) {
    this.proc = proc;
    this.stdoutRl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    this.stderrRl = readline.createInterface({ input: proc.stderr, crlfDelay: Infinity });
    this.stdoutRl.on('line', (line) => {
      for (const h of this.stdoutHandlers) {
        h(line);
      }
    });
    this.stderrRl.on('line', (line) => {
      for (const h of this.stderrHandlers) {
        h(line);
      }
    });
  }

  writeLine(line: string): void {
    const stdin = this.proc.stdin;
    if (stdin && !this.proc.killed) {
      stdin.write(line.endsWith('\n') ? line : `${line}\n`);
    }
  }

  writeRequest(req: ClientRequest): void {
    this.writeLine(JSON.stringify(req));
  }

  onStdoutLine(handler: (line: string) => void): void {
    this.stdoutHandlers.add(handler);
  }

  offStdoutLine(handler: (line: string) => void): void {
    this.stdoutHandlers.delete(handler);
  }

  onStderrLine(handler: (line: string) => void): void {
    this.stderrHandlers.add(handler);
  }

  offStderrLine(handler: (line: string) => void): void {
    this.stderrHandlers.delete(handler);
  }

  dispose(): void {
    this.stdoutRl.close();
    this.stderrRl.close();
    if (!this.proc.killed) {
      this.proc.kill('SIGTERM');
    }
  }
}
