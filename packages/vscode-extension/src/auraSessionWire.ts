import type { AuraTransport } from './auraTransport';

/** Wait for session/ack for a given session/start request id. */
export function waitForSessionAck(
  transport: AuraTransport,
  startReqId: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for session/ack'));
    }, timeoutMs);

    const onLine = (line: string) => {
      try {
        const ev = JSON.parse(line) as {
          type?: string;
          id?: string;
          result?: { sessionId?: string };
          payload?: { message?: string };
        };
        if (ev.type === 'session/ack' && ev.id === startReqId) {
          if (!ev.result?.sessionId) {
            cleanup();
            reject(new Error('Session was rejected (check schema version)'));
            return;
          }
          cleanup();
          resolve(ev.result.sessionId);
        } else if (ev.type === 'error') {
          cleanup();
          reject(new Error(ev.payload?.message ?? 'Daemon error'));
        }
      } catch {
        /* non-json */
      }
    };

    const cleanup = () => {
      clearTimeout(t);
      transport.offStdoutLine(onLine);
    };

    transport.onStdoutLine(onLine);
  });
}

/** Resolves when assistant/done, error, or session/cancelled for this session. */
export function createTurnWaiter(sessionId: string) {
  let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const onLine = (line: string) => {
    if (!pending) {
      return;
    }
    try {
      const ev = JSON.parse(line) as {
        type?: string;
        payload?: { sessionId?: string };
      };
      const sid = ev.payload?.sessionId;
      const sameSession = sid === undefined || sid === sessionId;
      if (!sameSession) {
        return;
      }
      if (
        ev.type === 'assistant/done' ||
        ev.type === 'error' ||
        ev.type === 'session/cancelled'
      ) {
        clearTimeout(timeout);
        timeout = undefined;
        const p = pending;
        pending = null;
        p.resolve();
      }
    } catch {
      /* non-json */
    }
  };

  const waitForTurnEnd = (ms: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (pending) {
        reject(new Error('internal: turn wait already active'));
        return;
      }
      pending = { resolve, reject };
      timeout = setTimeout(() => {
        if (pending) {
          const p = pending;
          pending = null;
          p.reject(new Error(`No assistant/done or error within ${Math.round(ms / 1000)}s`));
        }
      }, ms);
    });

  const dispose = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    pending = null;
  };

  return { onLine, waitForTurnEnd, dispose };
}
