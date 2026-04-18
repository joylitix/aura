import path from 'node:path';

/**
 * Minimal glob match for POC (no fast-glob — safe for esbuild ESM bundle).
 * Supports common patterns under a workspace-relative path using `/` or `\\`.
 */
export function matchSimpleGlob(relativePath: string, pattern: string): boolean {
  const r = relativePath.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/').replace(/^\.\//, '');

  if (p === '' || p === '**' || p === '**/*') {
    return true;
  }

  if (p.startsWith('**/')) {
    const rest = p.slice(3);
    if (rest === '*' || rest === '**') return true;
    if (rest.startsWith('*.')) {
      const suffix = rest.slice(1);
      return r.endsWith(suffix);
    }
    return r === rest || r.endsWith('/' + rest) || r.includes('/' + rest + '/');
  }

  if (!p.includes('*') && !p.includes('?')) {
    return r === p || r.endsWith('/' + p);
  }

  const base = path.posix.basename(r);
  const re = globPatternToRegExp(p);
  return re.test(r) || re.test(base);
}

function globPatternToRegExp(pattern: string): RegExp {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i += 2;
        if (pattern[i] === '/') i++;
        out += '.*';
      } else {
        i++;
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return new RegExp('^' + out + '$', 'i');
}
