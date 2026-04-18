# Aura — MVP build plan (repo)

Engineering breakdown for the **MVP** milestone. **Issue source of truth:** [GitHub milestone MVP](https://github.com/joylitix/aura/milestone/1), label [`mvp`](https://github.com/joylitix/aura/issues?q=is%3Aissue+label%3Amvp).

Published user docs stay high-level; this file is **maintainer-facing** (see [contributing/rules/docusaurus-docs.mdc](../contributing/rules/docusaurus-docs.mdc)).

## Phases ↔ GitHub issues

A **phase is not done** until every issue listed for that phase is **closed** (merged to default branch, or closed with a short comment). Prefer **`Closes #N`** / **`Fixes #N`** in the **merging** PR so GitHub auto-closes. Split PRs may use **`Refs #N`** until the final PR closes the issue.

| Phase | Scope | Issues |
|-------|--------|--------|
| **0 — POC close** | Exit checklist + tag `poc-0.1` | [#2](https://github.com/joylitix/aura/issues/2) |
| **1 — Chat transport + shell** | `AuraTransport` + chat lite (through dev protocol log) | [#3](https://github.com/joylitix/aura/issues/3) [#4](https://github.com/joylitix/aura/issues/4) [#5](https://github.com/joylitix/aura/issues/5) [#6](https://github.com/joylitix/aura/issues/6) [#7](https://github.com/joylitix/aura/issues/7) |
| **2 — Packaging** | Docker + Compose for `agent-daemon` | [#8](https://github.com/joylitix/aura/issues/8) |
| **3 — Remote transport** | TCP/Unix + auth + extension | [#9](https://github.com/joylitix/aura/issues/9) |
| **4 — CLI** | CLI NDJSON session parity | [#10](https://github.com/joylitix/aura/issues/10) |
| **5 — Protocol + core writes** | Modes + bounded writes | [#11](https://github.com/joylitix/aura/issues/11) [#12](https://github.com/joylitix/aura/issues/12) |
| **6 — Chat + Agent UX** | Tool cards + diff confirm | [#13](https://github.com/joylitix/aura/issues/13) |
| **7 — MCP** | Read merge + write gate | [#14](https://github.com/joylitix/aura/issues/14) [#15](https://github.com/joylitix/aura/issues/15) |
| **8 — Extension polish** | Multi-root, keys, a11y | [#16](https://github.com/joylitix/aura/issues/16) |
| **9 — Docs** | Docusaurus install / self-host / config | [#17](https://github.com/joylitix/aura/issues/17) |
| **10 — Release** | Semantic-release on `main` when shipping | [#18](https://github.com/joylitix/aura/issues/18) |

## Recommended order

Top to bottom; after **#3**, **#8** (Docker) may proceed in parallel with **#4–#7** if staffed. **#9** should follow **#8** for a realistic container attach story.

| Order | Issue | Summary |
|------:|-------|---------|
| 1 | [#2](https://github.com/joylitix/aura/issues/2) | POC exit + tag `poc-0.1` |
| 2 | [#3](https://github.com/joylitix/aura/issues/3) | `AuraTransport` (stdio NDJSON) |
| 3 | [#4](https://github.com/joylitix/aura/issues/4) | Chat lite: WebviewView + theming |
| 4 | [#5](https://github.com/joylitix/aura/issues/5) | Chat lite: composer + streaming bubbles |
| 5 | [#6](https://github.com/joylitix/aura/issues/6) | Chat lite: new chat, threads, Stop |
| 6 | [#7](https://github.com/joylitix/aura/issues/7) | Chat lite: tool progress + dev protocol log |
| 7 | [#8](https://github.com/joylitix/aura/issues/8) | Docker + Compose |
| 8 | [#9](https://github.com/joylitix/aura/issues/9) | TCP/Unix + auth |
| 9 | [#10](https://github.com/joylitix/aura/issues/10) | CLI parity |
| 10 | [#11](https://github.com/joylitix/aura/issues/11) | Protocol: Plan/Agent + versioning |
| 11 | [#12](https://github.com/joylitix/aura/issues/12) | Agent-core bounded writes |
| 12 | [#13](https://github.com/joylitix/aura/issues/13) | Tool cards + diff confirm |
| 13 | [#14](https://github.com/joylitix/aura/issues/14) | MCP read merge |
| 14 | [#15](https://github.com/joylitix/aura/issues/15) | MCP write gate |
| 15 | [#16](https://github.com/joylitix/aura/issues/16) | Extension polish |
| 16 | [#17](https://github.com/joylitix/aura/issues/17) | Docusaurus pages |
| 17 | [#18](https://github.com/joylitix/aura/issues/18) | Enable release workflow |

## Non-goals (MVP)

Desktop app, sub-agents at scale, model-pull UI, full `@` context — see deferred POC scope and internal Cursor MVP plan.
