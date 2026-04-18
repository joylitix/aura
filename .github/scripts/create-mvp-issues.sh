#!/usr/bin/env bash
# ONE-TIME helper: create MVP milestone issues on joylitix/aura.
# Do NOT re-run after issues exist — duplicates will clutter the repo.
# Requires: gh auth, milestone "MVP" and label "mvp" exist.
set -euo pipefail
REPO="joylitix/aura"
M="MVP"

create() {
  local title="$1"
  shift
  local body="$1"
  gh issue create -R "$REPO" -t "$title" -b "$body" -l mvp -l feat -m "$M"
}

create "MVP: Verify POC exit criteria and tag poc-0.1" "## Scope
Confirm [planning/POC_PLAN.md](https://github.com/joylitix/aura/blob/main/planning/POC_PLAN.md) §1.3 checklist (F5 flow, sandbox, cancel, README POC setup).

## Acceptance
- [ ] Checklist verified in a comment on this issue
- [ ] Git tag \`poc-0.1\` (or agreed name) pushed
- [ ] Note any gaps as follow-up issues"

create "MVP: AuraTransport abstraction (stdio NDJSON)" "## Scope
Refactor [packages/vscode-extension](https://github.com/joylitix/aura/tree/main/packages/vscode-extension) so all daemon I/O goes through an \`AuraTransport\` interface (stdio implementation first).

## Acceptance
- [ ] Interface supports: connect, writeLine, onLine, dispose, child PID optional
- [ ] Existing behavior unchanged (multi-turn still works)
- [ ] Unit-testable or manual test notes in PR"

create "MVP: Chat lite — WebviewView shell + theming" "## Scope
Register a **WebviewView** (Activity Bar or Secondary Side Bar) with empty/chat layout; VS Code theme CSS variables; no business logic beyond hello.

## Acceptance
- [ ] View visible and restorable; loads without CSP errors
- [ ] Light/dark follows workbench
- [ ] Document chosen surface in PR"

create "MVP: Chat lite — Composer + streaming assistant bubbles" "## Scope
Bottom composer (Enter send, Shift+Enter newline); post user messages; render \`assistant/delta\` into assistant bubble (markdown-safe v1: plain text ok).

## Acceptance
- [ ] Message list scrolls; streaming updates visible
- [ ] Wired to existing daemon session via \`AuraTransport\`
- [ ] No raw NDJSON in main UI"

create "MVP: Chat lite — New chat, thread switcher, Stop" "## Scope
**New chat** ends session and starts fresh \`session/start\`; minimal thread list or last-N sessions (in-memory ok for MVP). **Stop** sends \`session/cancel\` and clears in-flight UI.

## Acceptance
- [ ] New chat works without zombie daemon
- [ ] Stop interrupts turn; user can send again
- [ ] Thread UX documented in PR"

create "MVP: Chat lite — Tool progress + developer protocol log" "## Scope
Status line when \`tool/call\` / \`tool/result\` in flight. Command or setting to append raw NDJSON to **Aura** output channel for debugging.

## Acceptance
- [ ] User-visible status during tools
- [ ] Toggle/command documented in README snippet"

create "MVP: Docker + Compose for agent-daemon" "## Scope
Dockerfile + \`docker compose\` (or compose file) to run bundled daemon; env contract; README self-host section pointer.

## Acceptance
- [ ] \`docker compose up\` documented with required env vars
- [ ] Image builds in CI or documented local build"

create "MVP: TCP or Unix socket transport + auth" "## Scope
Remote transport for daemon; shared secret or mTLS (pick one, document threat model). Implement second \`AuraTransport\`. Extension settings: remote URL + token.

## Acceptance
- [ ] Extension can attach over TCP/Unix with auth
- [ ] Stdio transport still works
- [ ] Security notes in \`planning/\` or README"

create "MVP: CLI — NDJSON session parity" "## Scope
New \`packages/cli\` (workspace): \`session/start\`, \`chat/appendUser\`, stream events to stdout for CI/scripts.

## Acceptance
- [ ] Documented usage in README
- [ ] \`npm run build\` includes cli"

create "MVP: Protocol — Plan/Agent modes + versioning note" "## Scope
Extend [@aura/protocol](https://github.com/joylitix/aura/tree/main/packages/protocol): \`mode\` values, policy flags as needed; document \`schemaVersion\` bump rules.

## Acceptance
- [ ] Types + docs for new modes (stubs ok if core not ready)
- [ ] Backward compat story for existing clients"

create "MVP: Agent-core — bounded write tools + tests" "## Scope
\`write_file\` / \`apply_patch\`-style tool under \`workspaceRoot\` with caps; Vitest for sandbox + write policy.

## Acceptance
- [ ] No escape from workspace; size limits enforced
- [ ] Ask mode unchanged by default"

create "MVP: Chat lite — Tool cards + diff confirm/reject" "## Scope
Collapsible tool result cards; for proposed edits show diff (\`vscode.diff\` or webview) and **Confirm/Reject** before apply.

## Acceptance
- [ ] User cannot apply without confirm when policy requires
- [ ] Matches MVP safety row in planning/MVP_PLAN.md"

create "MVP: MCP — read-path tool merge" "## Scope
Connect stdio MCP server(s); merge **read** tools with namespacing + caps; document conflicts.

## Acceptance
- [ ] At least one MCP server works in dev
- [ ] Tool list visible to model with prefix"

create "MVP: MCP — write tools policy gate" "## Scope
MCP tools that mutate gated same as Agent writes; default deny or confirm path documented.

## Acceptance
- [ ] Policy tests or manual checklist in PR"

create "MVP: Extension polish — multi-root, keybindings, a11y" "## Scope
Workspace folder picker / scope chip; keybindings for focus composer, new chat, stop; basic a11y (labels, focus).

## Acceptance
- [ ] Multi-root no longer silent-first-folder-only
- [ ] Keybindings in \`package.json\`"

create "MVP: Docusaurus — install, self-host, config reference" "## Scope
User-facing pages under \`apps/docs\` (high level per repo rules): install, self-host daemon, extension settings table.

## Acceptance
- [ ] \`npm run docs:build\` green
- [ ] No full internal plans in published docs"

create "MVP: Enable semantic-release on main (when shipping)" "## Scope
Uncomment/add \`main\` to [.github/workflows/release.yml](https://github.com/joylitix/aura/blob/main/.github/workflows/release.yml) when team agrees stable semver from \`main\`.

## Acceptance
- [ ] CONTRIBUTING + rules updated if workflow text changes
- [ ] Dry-run or first release verified with maintainers"

echo "Done creating MVP issues."
