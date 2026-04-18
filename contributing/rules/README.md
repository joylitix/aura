# Contributor rules (Cursor-compatible)

These `.mdc` files are the **canonical** workflow and documentation policy for this repo.

**Local Cursor layout:** **`.cursor/`** is **gitignored** (never pushed to GitHub). Copy rules into **`.cursor/rules/`** after pulls or edits so Cursor can load them:

```bash
mkdir -p .cursor/rules
cp contributing/rules/*.mdc .cursor/rules/
```
