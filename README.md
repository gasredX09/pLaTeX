# pLaTeX

A full-LaTeX typesetting game with two separate experiences. Practice Mode is
an untimed, topic-by-topic curriculum. Blaze Mode is a three-minute challenge in
the spirit of [TeXnique](https://texnique.xyz/). In both modes, you get a printed
page and reproduce it in LaTeX.

The wordmark is set with LaTeX's own logo kerning, with gentler pulls than the
canonical ratios because the interface is monospaced. See `.logotype` in
`src/styles.css`.

Practice Mode has 24 ordered exercises across maths, text formatting, accents
and symbols, lists, tables, boxes and spacing, TikZ, and document structure.
Blaze Mode uses a completely separate catalog of 45 shuffled problems.

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

Blaze Mode scoring follows TeXnique: `ceil(source length / 10)` points per
problem, three minutes per run, and skipping costs only time. Practice Mode has
no timer or score. It saves completion per exercise, offers a hint and source
reveal, and returns skipped exercises once at the end of a topic.

The first run begins with a no-clock warm-up that shows the source to type and
teaches the compile, preview, and registration loop. Completion is stored in the
browser so returning players go straight to their selected mode.

Your Blaze best and Practice completion are kept separately in the browser's
local storage. There is no server, so both are per browser and per device. A
scoreless Blaze run is never recorded, and a tie does not count as beating it.

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
| `npm test` | Pure logic: both session types, catalog separation, practice progress, scoring, normalization, pixel comparison, and hash shim |
| `npm run smoke` | Engine init, cross-origin isolation, render determinism, equivalent-markup matching, near-miss rejection, recovery from a runaway macro |
| `npm run verify:problems` | Every problem compiles, renders non-blank, fits one page, stays inside the margins, and loads only bundled packages |
| `npm run verify:best` | The personal best across several runs: first record, missed record, beaten record, and survival of a reload |
| `npm run verify:build` | Both modes actually play through the production bundle, including persisted practice progress |
| `npm run shots` | Screenshots of every screen and state, for design review |

The browser-driven checks start their own dev server, so no separate `npm run dev`
is needed.

## Hosting

### The one hard requirement

**Serve `tex/bundles/*.data.gz` as opaque bytes.** Static hosts see the `.gz`
extension and add `Content-Encoding: gzip`, so the browser silently decompresses
them. The engine checks for `br` and otherwise assumes the body is still
compressed, running it through `DecompressionStream('gzip')` itself. Given
already-expanded bytes it throws, and every package fails to load. Serve these
with `Content-Type: application/octet-stream` and **no** `Content-Encoding`.

A host that cannot be told this cannot serve the bundles. `vite.config.ts`
handles it for `dev` and `preview`.

### Cross-origin isolation is optional

The engine prefers a `SharedArrayBuffer`, which browsers expose only to
cross-origin-isolated pages:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Its own documentation lists this as a requirement, but it is not one: the code
falls back to a plain `ArrayBuffer`. Measured without the headers, all 69
problems still compile and the median compile goes from 101ms to 115ms. Set them
if you can, but their absence is a performance note, not a blocker.

### Size

| | |
| --- | --- |
| The app | **1.9MB**, 7 files |
| The engine | ~94MB (29MB wasm, 63MB bundles, 1.6MB manifests) |
| Transferred on a first visit | ~50MB across 27 requests, ~30MB if the host brotlis the wasm |
| Transferred on later visits | nothing; the engine caches to browser storage |

Only 17 of the 61 bundles are reachable, so the other ~130MB need not be
deployed at all.

The shared preamble is a bandwidth decision as much as a typesetting one, because
the engine fetches a whole bundle per `\usepackage` on a player's first compile.
`tikz` alone pulls 30.6MB, so it sits only on the seven problems that draw with
it. The bundle is warmed when Blaze Mode or the TikZ practice topic is selected;
other practice topics do not request it. `tabularx` pulled 15.8MB for nothing and
is gone. `src/tex/document.test.ts` guards against the packages creeping back.

### Deploying

The app and the engine want different hosts. The app is small enough for anything;
the engine has a 29MB file, which exceeds the 25 MiB per-file limit on Cloudflare
Pages, and at ~30MB per new player a 100GB monthly cap is about 3,000 players.
Object storage with no egress charge removes both problems.

The split is config, not surgery, and is verified working cross-origin:

```bash
# 1. Engine to an R2 bucket. Uploads only the 17 reachable bundles, and sets
#    content types with no Content-Encoding.
npx wrangler login
BUCKET=platex-tex npm run upload:tex

# 2. Enable public reads on the bucket (custom domain preferred over r2.dev,
#    which is rate limited), and add a CORS rule allowing your app's origin.

# 3. Point the app at it. On GitHub Pages, set the repository variable
#    TEX_BASE and push; .github/workflows/deploy.yml does the rest.
VITE_TEX_BASE=https://tex.example.com npm run build
```

Two build-time variables:

| | |
| --- | --- |
| `VITE_TEX_BASE` | Where the wasm and bundles are served from. Defaults to `/tex`, which only works if they sit beside the app. |
| `VITE_BASE` | Path prefix. A GitHub *project* page is served from `/<repo>/`; a user or custom-domain site from `/`. |
| `VITE_TELEMETRY_ENDPOINT` | Optional HTTPS endpoint for sanitized reliability events. Empty disables telemetry. |

`public/tex/worker.js` always stays on the app's own origin, because a worker
script cannot be cross-origin. `npm run setup:worker` copies it out of
`node_modules`, so CI never downloads the 220MB.

### Optional reliability telemetry

Set the `TELEMETRY_ENDPOINT` repository variable to enable error reporting in
the Pages build. The browser sends small JSON `POST` requests for engine warm-up
failures, compile timeouts, target authoring failures, and unexpected errors.
The collector must accept cross-origin requests.

The payload is intentionally narrow. It contains a schema number, event name,
an error category, and a problem ID when a target fails. It never contains the
player's LaTeX, rendered content, score, personal best, browser details,
timestamp, or a persistent identifier. With no endpoint configured, the app
makes no telemetry requests. It also disables telemetry when Global Privacy
Control or Do Not Track is enabled. The collector will still receive ordinary
network metadata such as an IP address, so its retention policy remains part of
the deployment's privacy posture.

## Adding problems

Add Blaze problems to `src/problems.ts` and Practice exercises to
`src/practiceProblems.ts`, then run `npm run verify:problems`. The catalogs must
have distinct IDs and target source; unit tests enforce both rules.

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
  main.ts              mode selection, screens, keystroke to verdict
  game.ts              Blaze timer, score, deck, skip                [tested]
  problems.ts          the separate Blaze problem catalog            [tested]
  practiceProblems.ts  topics and ordered Practice catalog           [tested]
  practiceSession.ts   finite pass and skipped-item review            [tested]
  practiceProgress.ts  stored completion by problem ID                [tested]
  scoring.ts           ceil(len/10)                                  [tested]
  normalize.ts         equivalent-spelling rules                     [tested]
  personalBest.ts      the stored record                             [tested]
  onboarding.ts        first-run tutorial state and exercise          [tested]
  telemetry.ts         optional sanitized reliability events          [tested]
  tex/
    document.ts        page geometry, preamble, allowed packages
    engine.ts          WASM engine: warm, compile, timeout, restart
    warmProgress.ts    coarse cold-start milestones                    [tested]
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
