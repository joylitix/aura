import { describe, expect, it } from 'vitest';
import { matchSimpleGlob } from './simpleGlob.js';

describe('matchSimpleGlob', () => {
  it('matches **/* and **', () => {
    expect(matchSimpleGlob('src/a.ts', '**/*')).toBe(true);
    expect(matchSimpleGlob('a.ts', '**')).toBe(true);
  });

  it('matches **/*.ts', () => {
    expect(matchSimpleGlob('packages/foo/src/x.ts', '**/*.ts')).toBe(true);
    expect(matchSimpleGlob('readme.md', '**/*.ts')).toBe(false);
  });
});
