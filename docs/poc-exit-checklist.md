# POC exit checklist (issue #2)

Use this list before tagging **`poc-0.1`**. Record the date and commit SHA in the GitHub issue when closing.

## Automated

- [ ] From repo root: `npm install`
- [ ] `npm run build` succeeds (including `aura-vscode` prebuild → bundled daemon)
- [ ] `npm test` succeeds (`packages/agent-core` Vitest, including sandbox tests)

## Manual (VS Code / Cursor)

- [ ] **Run Aura extension** (F5 with `.vscode/launch.json` → Extension Development Host)
- [ ] Open a **single-root folder** in the host window
- [ ] **Aura: Start session** runs without “missing bundled daemon” errors
- [ ] At least one **Ask** turn completes (LLM + optional read-only tools), with output visible (chat UI or output channel per current build)
- [ ] **Empty message or Esc** ends the session; **`session/cancel`** is sent where applicable; child process does not linger as a zombie in normal flows

## Security / product (POC)

- [ ] **No writes / shell / patch** from the agent in Ask mode (tool allowlist review or spot-check)
- [ ] OpenAI key, if used, is stored in **Secret storage**, not workspace settings

## Tag

After the above:

```bash
git tag -a poc-0.1 -m "POC baseline verified (Ask-only, stdio NDJSON)"
git push origin poc-0.1
```

If the tag already exists on the remote, do not move it without team agreement; close the issue with a pointer to the existing tag.
