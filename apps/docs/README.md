# Aura docs (`@aura/docs`)

Docusaurus site for [Aura](https://github.com/joylitix/aura): **how to use the product** (install, configure, self-host, operate). This package is **not** the internal engineering handbook—for that, open **`../../aura.code-workspace`** and read **`aura-plans/README.md`** and **`aura-plans/AI_CONTEXT.md`** (not in git).

Source pages for this site live in **`docs/`** inside this package (Docusaurus convention—not the same as root **`docs/`**).

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
