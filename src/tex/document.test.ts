import { describe, it, expect } from 'vitest';
import { buildDocument, PREAMBLE, BUNDLED_PACKAGES, PRELOAD_BUNDLES } from './document.js';
import { problems } from '../problems.js';

/** Package names loaded by a preamble fragment. */
function packagesIn(preamble: string): string[] {
  return [...preamble.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g)].flatMap((m) =>
    m[1]!.split(',').map((s) => s.trim()),
  );
}

describe('buildDocument', () => {
  it('wraps a body in the class and shared preamble', () => {
    const doc = buildDocument('Hello');
    expect(doc.startsWith(String.raw`\documentclass[11pt]{article}`)).toBe(true);
    expect(doc).toContain(String.raw`\begin{document}`);
    expect(doc).toContain('Hello');
    expect(doc.trimEnd().endsWith(String.raw`\end{document}`)).toBe(true);
  });

  it('puts a problem preamble before the document body', () => {
    const doc = buildDocument('Hi', String.raw`\usepackage{tikz}`);
    expect(doc.indexOf('tikz')).toBeLessThan(doc.indexOf(String.raw`\begin{document}`));
  });

  it('omits the preamble slot entirely when there is none', () => {
    expect(buildDocument('Hi')).not.toContain('\n\n');
  });
});

describe('the shared preamble', () => {
  /*
   * These are a bandwidth guard, not a style rule. The engine downloads a whole
   * package bundle per \usepackage on a player's first compile, so anything
   * added here is paid for by every player before they can start. Adding tikz
   * back would cost everyone 30.6MB.
   */
  const heavy: Record<string, string> = {
    tikz: 'pgf-tikz, 30.6MB',
    pgf: 'pgf-tikz, 30.6MB',
    tabularx: 'tables, 15.8MB',
    longtable: 'tables, 15.8MB',
    multicol: 'tables, 15.8MB',
    beamer: 'beamer, 5MB',
    hyperref: 'hyperref',
    siunitx: 'math-ext',
    mathtools: 'math-ext',
  };

  it('loads no bundle-heavy package', () => {
    const offenders = packagesIn(PREAMBLE)
      .filter((p) => p in heavy)
      .map((p) => `${p} (pulls ${heavy[p]})`);
    expect(offenders).toEqual([]);
  });

  it('loads only packages known to be bundled', () => {
    const allowed = new Set<string>(BUNDLED_PACKAGES);
    for (const pkg of packagesIn(PREAMBLE)) expect(allowed).toContain(pkg);
  });

  it('still provides what most problems rely on', () => {
    const loaded = packagesIn(PREAMBLE);
    // amsmath for display maths, array for tabular column types, xcolor for
    // colour. tabular itself comes from the kernel, and its bundle from `core`.
    expect(loaded).toContain('amsmath');
    expect(loaded).toContain('array');
    expect(loaded).toContain('xcolor');
  });
});

describe('problem preambles', () => {
  it('declares tikz on exactly the problems that draw with it', () => {
    for (const problem of problems) {
      const usesTikz = problem.latex.includes('tikzpicture');
      const declaresTikz = packagesIn(problem.preamble ?? '').includes('tikz');
      expect(declaresTikz, `${problem.id}: draws=${usesTikz} declares=${declaresTikz}`).toBe(
        usesTikz,
      );
    }
  });

  it('preloads the bundle those problems need', () => {
    // Without this the 30.6MB fetch lands mid-run and stalls the clock.
    expect(PRELOAD_BUNDLES).toContain('pgf-tikz');
  });
});
