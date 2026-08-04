# pLaTeX

A LaTeX speed-typesetting game, in the spirit of [TeXnique](https://texnique.xyz/)
but for **full LaTeX** rather than only maths. You get a printed page; reproduce
it in LaTeX before the clock runs out.

The wordmark is set with LaTeX's own logo kerning, with gentler pulls than the
canonical ratios because the interface is monospaced. See `.logotype` in
`src/styles.css`.

Problems cover maths, text formatting, accents and symbols, lists, tables, boxes
and spacing, TikZ, and document structure.

## How it decides you are right

A real TeX Live 2025 engine, compiled to WebAssembly, runs in your browser. Both
the target and what you type are compiled to PDF, rasterized at the same scale,
and compared pixel for pixel.

The upshot is that **anything that typesets identically is accepted**.
`\textbf{x}` and `{\bfseries x}` both pass, because TeX emits the same page for
each. A handful of regex rules in `src/normalize.ts` additionally fold together
spellings that differ only in spacing, such as `\not\in` and `\notin`; unlike
TeXnique those are applied to the target as well as to your input, so a target
can be authored in either spelling without becoming unsolvable.

Scoring follows TeXnique: `ceil(source length / 10)` points per problem, three
minutes per run, skipping costs only time.

Your best run is kept in the browser's local storage, shown on the intro, beside
the running score so you can see what you are chasing, and on the end sheet.
There is no server, so the record is per browser and per device. A scoreless run
is never recorded, and a tie does not count as beating it.

## Setup

```bash
npm install
npm run setup   # downloads ~220MB of TeX engine and packages into public/tex
npm run dev
```

`npm run setup` is required and only needs to run once. It pins the engine and
bundle versions on purpose: the game compares renders pixel for pixel, so a
different TeX build can change glyph rasterization enough to break comparison.

## Verifying

```bash
npm run verify           # everything below, in order
```

| Command | What it covers |
| --- | --- |
| `npm test` | Pure logic: scoring, normalization, pixel comparison, run state, hash shim |
| `npm run smoke` | Engine init, cross-origin isolation, render determinism, equivalent-markup matching, near-miss rejection, recovery from a runaway macro |
| `npm run verify:problems` | Every problem compiles, renders non-blank, fits one page, stays inside the margins, and loads only bundled packages |
| `npm run verify:best` | The personal best across several runs: first record, missed record, beaten record, and survival of a reload |
| `npm run verify:build` | The production bundle actually plays, from a cold cache |
| `npm run shots` | Screenshots of every screen and state, for design review |

The browser-driven checks start their own dev server, so no separate `npm run dev`
is needed.

## Hosting

Two requirements, both easy to miss, and both fatal to the engine if unmet.

**1. Cross-origin isolation.** The engine talks to its worker through a
`SharedArrayBuffer`, which browsers expose only to isolated pages:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**2. Serve `tex/bundles/*.data.gz` as opaque bytes.** Static hosts see the `.gz`
extension and add `Content-Encoding: gzip`, so the browser silently decompresses
them. The engine checks for `br` and otherwise decompresses the body itself, so
it receives already-expanded bytes and every package fails to load. Serve these
with `Content-Type: application/octet-stream` and **no** `Content-Encoding`.

`vite.config.ts` handles both for `dev` and `preview`; a production host needs
the same treatment.

## Adding problems

Add an entry to `src/problems.ts`, then run `npm run verify:problems`.

The `latex` field is a document *body*; the class and preamble come from
`src/tex/document.ts`. Constraints the verifier enforces:

- It must fit an 80x32mm page with 3mm margins, roughly 45 characters by 6 lines.
  Only page one is compared, so anything that overflows is invisible and unfair.
- It may only use packages in `BUNDLED_PACKAGES`. Notably **`booktabs`,
  `enumitem`, `varwidth`, `ulem`, `cancel` and `stmaryrd` are unavailable** —
  they are absent from the engine's bundles, and reaching them would mean a
  network fetch mid-run. Use `\hline` rather than `\toprule`.

## Layout

```
src/
  main.ts              screen transitions, the clock, keystroke to verdict
  game.ts              run state: timer, score, deck, skip           [tested]
  problems.ts          the problem set
  scoring.ts           ceil(len/10)                                  [tested]
  normalize.ts         equivalent-spelling rules                     [tested]
  personalBest.ts      the stored record                             [tested]
  tex/
    document.ts        page geometry, preamble, allowed packages
    engine.ts          WASM engine: warm, compile, timeout, restart
    compileQueue.ts    debounce, drop stale results, compare
    blake3-shim.ts     replaces an unbundlable dependency            [tested]
  render/
    rasterize.ts       PDF bytes to pixels via pdf.js
    compare.ts         strict pixel equality                         [tested]
```

## Notes on the design

**Why a fixed page rather than the `standalone` class.** `standalone` would crop
each page to its content, which is the natural choice, but it is not in the
engine's bundles. So the template uses `article` with `geometry` at a fixed small
page. The page is sized snugly on purpose: the render is shown in a fixed-width
card, so every unused millimetre shrinks the type the player is reading.

**Why the comparison allows zero differing pixels.** Both images come from the
same engine and rasterizer, so a correct answer is byte-identical. Real
near-misses can be tiny — a hyphen where an en dash belongs moves a few dozen
pixels out of ~230k — so any tolerance loose enough to absorb noise would also
accept those. There is no noise to absorb, so none is allowed.

**Why the engine can be killed.** Runaway macro expansion (`\def\x{\x}\x`) is an
ordinary typo here, and TeX cannot be interrupted once it is spinning. Compiles
that pass five seconds are abandoned and the worker is destroyed and rebuilt.
