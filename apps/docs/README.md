# Aura docs (`@aura/docs`)

Docusaurus site for [Aura](https://github.com/jennifer-dickinson/aura). Source lives in **`docs/`** under this package.

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
