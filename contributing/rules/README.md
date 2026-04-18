# Contributor rules (Cursor-compatible)

These `.mdc` files are the **canonical** workflow and documentation policy for this repo.

**Local Cursor layout:** **`.cursor/`** is **gitignored** (never pushed to GitHub) but should exist in your clone so Cursor can load rules and scratch plans. Keep **`.cursor/rules/`** in sync with this folder after pulls or edits:

```bash
mkdir -p .cursor/rules .cursor/plans
cp contributing/rules/*.mdc .cursor/rules/
```

Scratch notes go under **`.cursor/plans/`** (gitignored); keep that directory if you use Cursor session exports there.
