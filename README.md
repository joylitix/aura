# Aura

**Aura** (Joylitix) is a self-hosted agent platform. This monorepo holds the Docusaurus docs site, the **POC** VS Code extension with a local daemon, and shared packages.

Private repository: see [CONTRIBUTING.md](CONTRIBUTING.md) for branches, release automation, and contributor workflow.

## POC setup

The proof-of-concept path is: **extension** → spawns **daemon** (stdio, NDJSON) → **agent-core** (Ask mode, read-only file tools) → **OpenAI-compatible** or **Ollama** HTTP APIs.

### Prerequisites

- **Node 20+**
- For OpenAI: an API key (the extension stores it in VS Code **Secret storage**, not the workspace).
- For Ollama: a running Ollama instance; set **Aura: Ollama base URL** if not `http://127.0.0.1:11434`.

### Build

From the repository root:

```bash
npm install
npm run build
```

`npm run build` runs each workspace’s build script (order can vary). The **`aura-vscode`** package’s `compile` / `build` runs **`prebuild`**, which rebuilds **`@aura/agent-daemon`** (which in turn rebuilds **`@aura/protocol`** and **`@aura/agent-core`**) before copying `daemon.mjs` into `packages/vscode-extension/bundled/`, so the bundled daemon stays in sync and does not pull in packages that break under a single-file ESM bundle (the old `fast-glob` + `require('os')` issue).

```bash
npm test
```

Runs `vitest` in `packages/agent-core` (sandbox tests).

### Run the VS Code extension (F5)

1. Open this repo in VS Code / Cursor.
2. `npm run build` at least once (so the bundled daemon exists under `packages/vscode-extension/bundled/`).
3. **Run and Debug** → **Run Aura extension** (see [.vscode/launch.json](.vscode/launch.json)).
4. In the new Extension Development Host window, use **File → Open Folder…** and pick a project folder (single root). If you skip this, **Aura: Start session** will prompt you to open a folder—ignore unrelated **Debug Console** lines from Cursor itself (`NoWorkspaceUriError`, `UserNotLoggedInError`, OTLP, sandbox helper, etc.).
5. Command palette → **Aura: Start session** (`aura.startSession`).
6. If prompted, enter your **OpenAI API key** (stored in Secret storage) when using the OpenAI provider; or set settings to **Ollama** and a model (e.g. a local `llama3.2` or your preferred tag).
7. Use the **input box for each turn** — you can have a **back-and-forth** in one session; leave the message **empty** or press **Esc** to end. Replies and tool traces appear in the **Aura** output channel.

**Ask / POC (read-only):** The agent can **read and search** files (`read_file`, `glob_file_search`, `grep`) but **cannot create, edit, or delete** files by design (see [planning/POC_PLAN.md](planning/POC_PLAN.md)). Agent / write-capable modes are out of scope for this POC.

**Cancel / dispose:** Stopping the debug session or deactivating the host disposes the extension; the child daemon process is signalled. Ending the chat with an empty message sends `session/cancel` then terminates the child.

### Run the daemon from the terminal (smoke)

After `npm run build`:

```bash
export AURA_OPENAI_API_KEY=   # for OpenAI provider, set your key
printf '%s\n' '{"type":"session/start","id":"1","params":{"schemaVersion":"0.1.0","workspaceRoot":"'$(pwd)'","workspaceId":"w1","threadId":"t1","mode":"ask","provider":"ollama","modelId":"llama3.2","ollamaBaseUrl":"http://127.0.0.1:11434"}}' | node packages/agent-daemon/dist/daemon.mjs
```

You should get a `session/ack` line. For a follow-up, pipe another line with `chat/appendUser` in the same session, or use the extension for full flows.

## Repository layout (high level)

| Path | Role |
|------|------|
| [apps/docs](apps/docs) | Docusaurus public documentation (`npm run docs:dev` from root) |
| [packages/protocol](packages/protocol) | Versioned stdio/NDJSON message types |
| [packages/agent-core](packages/agent-core) | Ask loop, tools, LLM clients, transcript |
| [packages/agent-daemon](packages/agent-daemon) | stdio process bundled for the extension |
| [packages/vscode-extension](packages/vscode-extension) | VS Code `aura` extension (POC) |
| [planning/POC_PLAN.md](planning/POC_PLAN.md) | Detailed internal POC spec (not published on the doc site) |

## Docs

- Public docs: `npm run docs:dev` — [CONTRIBUTING](CONTRIBUTING.md) lists CI, including the GitHub Pages workflow for the doc site when relevant paths change.
