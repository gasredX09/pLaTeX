/**
 * Wires the game to the page: screen transitions, the clock, and the loop from
 * keystroke to verdict.
 */
import './styles.css';
import { Game, formatClock } from './game.js';
import { problems } from './problems.js';
import { formatPoints } from './scoring.js';
import { TexEngine } from './tex/engine.js';
import { AttemptChecker, type CheckStatus } from './tex/compileQueue.js';
import { paint } from './render/rasterize.js';
import {
  browserStorage,
  readBest,
  submitRun,
  describeBest,
  type BestRun,
} from './personalBest.js';

function need<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as unknown as T;
}

const ui = {
  intro: need<HTMLElement>('intro'),
  play: need<HTMLElement>('play'),
  end: need<HTMLElement>('end'),

  start: need<HTMLButtonElement>('start'),
  engineStatus: need<HTMLParagraphElement>('engine-status'),

  clock: need<HTMLElement>('clock'),
  clockFill: need<HTMLElement>('clock-fill'),
  score: need<HTMLElement>('score'),

  problemNumber: need<HTMLElement>('problem-number'),
  problemPoints: need<HTMLElement>('problem-points'),
  problemTitle: need<HTMLElement>('problem-title'),
  problemDescription: need<HTMLElement>('problem-description'),

  targetCanvas: need<HTMLCanvasElement>('target-canvas'),
  attemptCanvas: need<HTMLCanvasElement>('attempt-canvas'),
  registration: need<HTMLElement>('registration'),

  input: need<HTMLTextAreaElement>('input'),
  status: need<HTMLElement>('status'),
  statusText: need<HTMLElement>('status-text'),
  skip: need<HTMLButtonElement>('skip'),

  finalEyebrow: need<HTMLElement>('final-eyebrow'),
  finalScore: need<HTMLElement>('final-score'),
  finalSummary: need<HTMLElement>('final-summary'),
  solvedList: need<HTMLUListElement>('solved-list'),
  skippedList: need<HTMLUListElement>('skipped-list'),
  again: need<HTMLButtonElement>('again'),

  introBest: need<HTMLElement>('intro-best'),
  introBestValue: need<HTMLElement>('intro-best-value'),
  railBest: need<HTMLElement>('rail-best'),
  finalBest: need<HTMLElement>('final-best'),
  finalBestLabel: need<HTMLElement>('final-best-label'),
  finalBestValue: need<HTMLElement>('final-best-value'),
};

const storage = browserStorage();
/** Cached so the rail can show it without touching storage every second. */
let best: BestRun | null = readBest(storage);

const game = new Game(problems);

// A short round is handy when checking the end screen. Dev only, so the shipped
// game always runs the full three minutes.
if (import.meta.env.DEV) {
  const seconds = Number(new URLSearchParams(location.search).get('seconds'));
  if (Number.isFinite(seconds) && seconds > 0) game.roundSeconds = seconds;
}

const engine = new TexEngine();
const checker = new AttemptChecker(engine, onCheckOutcome);

let clockTimer: ReturnType<typeof setInterval> | undefined;
/** Guards against a late compile scoring a problem twice. */
let awaitingAdvance = false;

// ------------------------------------------------------------------- engine

engine.onStageChange = (stage, detail) => {
  if (stage === 'ready') {
    ui.start.disabled = false;
    ui.start.textContent = 'Start the clock';
    ui.engineStatus.textContent = 'TeX Live ready. Cached for next time.';
  } else if (stage === 'failed') {
    ui.start.textContent = 'Engine unavailable';
    ui.engineStatus.textContent = `Could not load the TeX engine: ${detail ?? 'unknown error'}. Reload to try again.`;
  } else if (stage === 'loading' && detail) {
    ui.engineStatus.textContent = detail;
  }
};

// Download and warm behind the intro screen, so the wait overlaps with reading.
void engine.warm().catch(() => {
  /* Surfaced through onStageChange. */
});

renderBest();

// --------------------------------------------------------------- transitions

function show(screen: 'intro' | 'play' | 'end'): void {
  ui.intro.hidden = screen !== 'intro';
  ui.play.hidden = screen !== 'play';
  ui.end.hidden = screen !== 'end';
}

/** Shows the standing record wherever it appears, or hides it if there is none. */
function renderBest(): void {
  ui.introBest.hidden = !best;
  ui.railBest.hidden = !best;
  if (!best) return;
  ui.introBestValue.textContent = describeBest(best);
  ui.railBest.textContent = String(best.score);
}

function startRun(): void {
  game.start();
  show('play');
  renderBest();
  renderRail();
  void loadCurrentProblem();

  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (game.tick()) finishRun();
    renderRail();
  }, 1000);

  ui.input.focus();
}

function finishRun(): void {
  clearInterval(clockTimer);
  checker.cancel();
  ui.input.disabled = true;
  renderEnd();
  show('end');
  ui.again.focus();
}

// ------------------------------------------------------------------ drawing

function renderRail(): void {
  ui.clock.textContent = formatClock(game.secondsLeft);
  ui.score.textContent = String(game.score);
  const remaining = (game.secondsLeft / game.roundSeconds) * 100;
  ui.clockFill.style.width = `${remaining}%`;
  ui.clockFill.classList.toggle('urgent', game.secondsLeft <= 30);
}

async function loadCurrentProblem(): Promise<void> {
  const problem = game.current;
  awaitingAdvance = false;

  ui.problemNumber.textContent = `Problem ${game.problemNumber}`;
  ui.problemPoints.textContent = formatPoints(game.currentPoints);
  ui.problemTitle.textContent = problem.title;
  ui.problemDescription.textContent = problem.description;

  ui.input.value = '';
  // Held shut until the target exists. It compiles in about a tenth of a
  // second, and leaving the field live would let a fast paste be judged against
  // a target that has not been rendered yet.
  ui.input.disabled = true;
  clearCanvas(ui.attemptCanvas);
  clearCanvas(ui.targetCanvas);
  setStatus('idle');

  const target = await checker.setProblem(problem.latex, problem.preamble);
  // The run may have ended, or the player may have skipped, while this compiled.
  if (game.status !== 'running' || game.current !== problem) return;

  if (!target) {
    // An authoring bug rather than anything the player did. Do not burn their
    // clock on an unsolvable problem.
    setStatus('invalid', 'This problem failed to compile. Skipping.');
    advance(() => game.skip());
    return;
  }
  paint(ui.targetCanvas, target);
  ui.input.disabled = false;
  ui.input.focus();
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

const STATUS_TEXT: Record<CheckStatus, string> = {
  idle: 'Ready',
  compiling: 'Typesetting…',
  mismatch: 'Not yet in register',
  invalid: 'Does not compile',
  match: 'In register',
  timeout: 'That took too long to typeset. Engine restarted.',
};

function setStatus(status: CheckStatus, override?: string): void {
  ui.statusText.textContent = override ?? STATUS_TEXT[status];
  ui.status.className = `status is-${status}`;
  ui.registration.className = `registration is-${status}`;
}

function onCheckOutcome({ status, image }: { status: CheckStatus; image?: ImageData }): void {
  if (game.status !== 'running' || awaitingAdvance) return;

  setStatus(status);
  if (image) paint(ui.attemptCanvas, image);
  else if (status === 'idle' || status === 'invalid') clearCanvas(ui.attemptCanvas);

  if (status === 'match') {
    ui.input.disabled = true;
    advance(() => game.solve());
  }
}

/**
 * Applies an outcome and deals the next problem after a short beat, so the
 * locked registration mark is legible before the screen changes.
 */
function advance(apply: () => void): void {
  awaitingAdvance = true;
  checker.cancel();
  apply();
  renderRail();
  setTimeout(() => {
    if (game.status !== 'running') return;
    // loadCurrentProblem takes the focus back once the target is on screen.
    void loadCurrentProblem();
  }, 450);
}

function renderEnd(): void {
  ui.finalScore.textContent = String(game.score);
  const count = game.solved.length;
  ui.finalSummary.textContent =
    count === 0
      ? 'Nothing set this run. The engine is warm now, which helps.'
      : `${count} ${count === 1 ? 'problem' : 'problems'} set in three minutes.`;

  // Record the run before reading the record back, so a new best is reflected
  // here and on the intro when the player returns to it.
  const previous = best;
  const outcome = submitRun(storage, { score: game.score, solved: count });
  best = outcome.best;

  ui.finalEyebrow.textContent = outcome.isNewBest ? 'New personal best' : 'Time up';

  // On a new best the headline score already *is* the record, so the line below
  // shows what was beaten instead of repeating the same number back. With no
  // record either way there is nothing to say.
  const footnote = outcome.isNewBest
    ? previous && { label: 'Previous best', run: previous }
    : best && { label: 'Your best', run: best };

  ui.finalBest.hidden = !footnote;
  if (footnote) {
    ui.finalBestLabel.textContent = footnote.label;
    ui.finalBestValue.textContent = describeBest(footnote.run);
  }

  renderBest();

  fill(ui.solvedList, game.solved.map((s) => [s.problem.title, `+${s.points}`]), 'Nothing yet');
  fill(ui.skippedList, game.skipped.map((p) => [p.title, '']), 'Nothing skipped');
}

function fill(list: HTMLUListElement, rows: [string, string][], empty: string): void {
  list.replaceChildren();
  if (rows.length === 0) {
    const li = document.createElement('li');
    li.className = 'ledger-empty';
    li.textContent = empty;
    list.append(li);
    return;
  }
  for (const [title, note] of rows) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = title;
    const value = document.createElement('span');
    value.textContent = note;
    li.append(name, value);
    list.append(li);
  }
}

// ------------------------------------------------------------------- events

ui.start.addEventListener('click', startRun);
ui.again.addEventListener('click', startRun);

ui.input.addEventListener('input', () => {
  if (game.status !== 'running' || awaitingAdvance) return;
  checker.update(ui.input.value);
});

ui.skip.addEventListener('click', () => {
  if (game.status !== 'running' || awaitingAdvance) return;
  advance(() => game.skip());
});

// A tab in the editor should indent, not leave for the Skip button.
ui.input.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = ui.input;
  ui.input.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  ui.input.selectionStart = ui.input.selectionEnd = selectionStart + 2;
  checker.update(ui.input.value);
});
