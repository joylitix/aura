# Contributing to Aura

## Repository

- **Git remote:** [github.com/joylitix/aura](https://github.com/joylitix/aura) (Joylitix organization; **private**—sign in with an account that has org access)

To clone or push after the org move, update your local remote if needed: `git remote set-url origin git@github.com:joylitix/aura.git`

### MVP track (GitHub)

- **AI assistants:** open **`aura.code-workspace`** (loads **aura** + **aura-plans**). Read **`../aura-plans/README.md`** → **`../aura-plans/AI_CONTEXT.md`** → `POC_PLAN.md` / `MVP_PLAN.md` in that folder → optional local **`aura/.cursor/plans/`** (gitignored) → this file.
- **Milestone:** [MVP](https://github.com/joylitix/aura/milestone/1) — chunked issues with label **`mvp`**.
- **Checklist / order:** **`aura-plans/MVP_PLAN.md`** (not in git; links every ticket). Work issues **one at a time** in the suggested order unless a PR explicitly depends on another.
- **Phases:** A phase is complete only when **all issues in that phase** are **closed** on GitHub (use `Fixes #N` / `Closes #N` in PR bodies when merging to default branch). See **“Phases and closing issues”** in **`aura-plans/MVP_PLAN.md`**.

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

### Release candidates (`rc/*`)

Work that is intended for the **next stable release** should flow through **`rc/*`** before **`main`**:

1. **Create** an RC line from current `main`, e.g. **`rc/0.2.0`** or **`rc/mvp-1`** (pick one naming style per release train and stick to it).
2. **Merge feature branches** into the RC branch via PR (**squash** is fine; **conventional PR title** still applies).
3. **Stabilize** on `rc/*`: run tests, Copilot review, docs; **semantic-release** publishes **prereleases** from `rc/*` (tags like **`x.y.z-rc.n`**, GitHub “Pre-release”) so installers can dogfood without promoting stable.
4. When the RC is approved, open **one** PR: **`rc/<name>` → `main`**. This is the merge that **promotes** work to stable. **Prefer a merge commit** (not squash) for `rc → main` so all conventional commits remain visible to **semantic-release** and the changelog; if you must squash, use one **conventional** title that summarizes the release (e.g. `feat: release 0.2.0`).
5. **Do not** land unrelated new features on **`main`** during an active RC freeze without team agreement—use a **new `rc/*`** line or wait until after the RC lands on `main`.

**Hotfix path:** urgent production fixes can go **`fix/*` → `main`** by exception; document in the PR why the RC train was bypassed.

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

- **Documentation site** (Docusaurus) lives in **`apps/docs/`**. From the repo root:
  - `npm install` — install all workspace dependencies (once, or after lockfile changes).
  - `npm run build` — compile protocol, agent packages, and the VS Code extension; copy the daemon bundle (see [README](README.md) “POC setup” for F5 and LLM requirements).
  - `npm test` — runs `vitest` in **`packages/agent-core`**, etc.
  - `npm run docs:dev` — local preview at `http://localhost:3000` (with this repo’s GitHub Pages **`baseUrl`**, open **`/aura/`** on the dev server if configured).
  - `npm run docs:build` — production build into `apps/docs/build/`.
- **Internal engineering plans** (full POC specs, sprint breakdowns, etc.) are **not** part of the published Docusaurus site. Keep them in the **aura-plans** workspace folder (see **`aura.code-workspace`**)—for example **`aura-plans/POC_PLAN.md`**. The docs site may include **high-level roadmaps** only—see **`apps/docs/docs/development/roadmap.md`**.

## Commits

Prefer **small, logical commits**; see **`contributing/rules/incremental-commits.mdc`**.

### Releases (automated)

- **semantic-release** runs on pushes to **`rc/*`** and on **workflow_dispatch** (see `.github/workflows/release.yml`). Pushes to **`main`** do **not** run the release job for now—re-add **`main`** to that workflow when you want stable semver from default branch merges.
- When enabled for **`main`**: **stable** semver (`x.y.z`), full **GitHub Release** (not marked pre-release).
- **`rc/*`**: **prerelease** semver (`x.y.z-rc.n`), GitHub Release marked **Pre-release** — use for integration and QA before promoting to `main`.
- Semver is computed from [Conventional Commits](https://www.conventionalcommits.org/) on the **branch that was pushed**; **`CHANGELOG.md`** / **`package.json`** updates follow the same bot commit (`[skip ci]`) pattern on each line.
- For **`feat/*` → `rc/*`**, **squash merge** + conventional **PR title** is typical (validated by **`Semantic PR title`**). For **`rc/*` → `main`**, prefer a **merge commit** so release notes include each integrated change (see **Release candidates** above).
- **What bumps the version:** typically **`feat`** (minor), **`fix`** / **`perf`** (patch), **breaking changes** (`feat!:` or `BREAKING CHANGE:` footer) (major). Commits like **`chore:`** / **`docs:`** / **`ci:`** often produce **no** new release (by design).
- After the release bot pushes **`chore(release): x.y.z [skip ci]`**, the release workflow **skips** to avoid an infinite loop.

## Continuous integration

| Workflow | Purpose |
|----------|---------|
| `semantic-pr-title.yml` | PR title matches Conventional Commits |
| `release.yml` | Push to **`rc/*`** (or manual run) → semantic-release (**`-rc.n`**). **`main`** is currently excluded until stable releases are turned on. |
| `docs-pages.yml` | Push to **`main`** with changes under **`apps/docs/`**, lockfile, or this workflow → Docusaurus build → **GitHub Pages** (or run **Docs (GitHub Pages)** manually via **Actions → workflow_dispatch**) |

**`contributing/rules/github-releases.mdc`** summarizes agent expectations.
