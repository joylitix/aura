# Contributing to Aura

## Repository

- **Git remote:** [github.com/jennifer-dickinson/aura](https://github.com/jennifer-dickinson/aura)
- To host under a **Joylitix** GitHub organization later, use **Settings → General → Transfer repository** (requires org admin).

## GitHub workflow

### Branches

- **`main`** is **protected**: ship only through **pull requests**; do **not** push large feature work directly to `main`.
- **Major or non-trivial features** → new branch from latest `main`, prefix by intent:

| Prefix | Use for |
|--------|---------|
| `feat/` | New capability, new mode slice, new public API |
| `fix/` | Bug fixes, regressions |
| `docs/` | Documentation and Docusaurus-only changes |
| `chore/` | CI, deps, refactors with no product behavior change |
| `refactor/` | Internal structure change; behavior preserved |

Examples: `feat/ask-stdio-daemon`, `fix/path-sandbox-escape`, `docs/self-host-compose`.

- **One feature / concern per branch** where possible. After opening a PR, **avoid piling unrelated commits** for “the next thing”—open a **new branch after `main` is updated** from the merge.

### Labels (GitHub)

Use labels on **issues and PRs** so release notes and filtering stay sane. This repo includes **`feat`**, **`fix`**, **`docs`**, **`chore`**, **`refactor`**, **`blocked`** (GitHub’s default labels remain available too).

| Label | Meaning |
|-------|---------|
| `feat` | Feature work |
| `fix` | Bug fix |
| `docs` | Documentation |
| `chore` | Maintenance |
| `refactor` | Internal restructure |
| `blocked` | Waiting on external input |

Match the **branch prefix** and **PR title** when applicable (e.g. `feat: add stdio transport`).

### Pull requests

1. Open a **draft** early if you want early CI or Copilot feedback.
2. Request review; enable **GitHub Copilot code review** on the repo (see below).
3. **Wait for approved merge** into `main` before starting the **next** major chunk on a **new** branch rebased/merged from `main`. Do not assume chained unpublished work stays linear—**merge first, branch second**.

### GitHub Copilot code review

Repository **owners** should enable:

1. **Settings → Copilot** (organization/repo depending on plan) — ensure **Copilot** is allowed for this repo.
2. Turn on **Copilot code review** for pull requests (see [GitHub Docs: Using Copilot code review](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review)).

Contributors: treat Copilot comments like any reviewer—address or reply with why something is deferred.

### Branch protection (recommended for maintainers)

In **Settings → Rules → Rulesets** (or classic branch protection):

- Require **pull request** before merging to `main`.
- Optional: required **approval(s)**, **status checks** once CI exists.

---

## Local development

See `docs/POC_PLAN.md` and future Docusaurus docs for build and run instructions as the codebase grows.

## Commits

Prefer **small, logical commits**; see `.cursor/rules/incremental-commits.mdc`.
