# Aura docs (`@aura/docs`)

Docusaurus site for [Aura](https://github.com/joylitix/aura): **how to use the product** (install, configure, self-host, operate). Internal engineering plans (MVP phases, checklists) live in the monorepo **[`../docs/`](../docs/)**—not in this published site.

Source pages for this site live in **`docs/`** inside this package (Docusaurus convention—not the same as root **`docs/`**).

## Versioning

- **`docs/`** here = **Next** (unreleased edits). Frozen releases live under **`versioned_docs/version-x.y.z/`**, driven by **`versions.json`**.
- **Locally:** `npm run docs:version --workspace=@aura/docs -- 1.2.3` snapshots the current `docs/` tree as version **1.2.3** (commit the generated files in the same PR when appropriate).
- **CI:** when a **stable** GitHub Release is published, **`.github/workflows/docs-version-snapshot.yml`** runs the same command at the release tag and pushes the result to the default branch. **Prereleases** are ignored so RC tags do not add dropdown entries.

## From the monorepo root

```bash
npm install
npm run docs:dev
npm run docs:build
```

## From this directory

```bash
npm install
npm start
npm run build
```

Built output: **`build/`** (ignored by git). GitHub Pages for this repo uses **`baseUrl: '/aura/'`** — local dev may use `http://localhost:3000/aura/` depending on config.
