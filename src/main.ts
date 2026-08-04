/**
 * Wires the game to the page: screen transitions, the clock, and the loop from
 * keystroke to verdict.
 */
import './styles.css';
import { Game, formatClock } from './game.js';
import { problems } from './problems.js';
import { formatPoints } from './scoring.js';
import { TexEngine } from './tex/engine.js';
import { PRELOAD_BUNDLES } from './tex/document.js';
import { FIRST_VISIT_MB } from './tex/warmProgress.js';
import { AttemptChecker, type CheckStatus } from './tex/compileQueue.js';
import { paint } from './render/rasterize.js';
import {
  completeTutorial,
  hasCompletedTutorial,
  TUTORIAL,
} from './onboarding.js';
import { classifyError, telemetry } from './telemetry.js';
import {
  browserStorage,
  readBest,
  submitRun,
  describeBest,
  type BestRun,
} from './personalBest.js';

window.addEventListener('error', (event) => {
  telemetry.report({
    event: 'unexpected_error',
    reason: classifyError(event.error ?? event.message),
  });
});
window.addEventListener('unhandledrejection', (event) => {
  telemetry.report({ event: 'unexpected_error', reason: classifyError(event.reason) });
});

function need<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as unknown as T;
}

const ui = {
  intro: need<HTMLElement>('intro'),
  tutorial: need<HTMLElement>('tutorial'),
  play: need<HTMLElement>('play'),
  end: need<HTMLElement>('end'),

  start: need<HTMLButtonElement>('start'),
  engineStatus: need<HTMLParagraphElement>('engine-status'),
  engineNote: need<HTMLParagraphElement>('engine-note'),
  engineProgress: need<HTMLProgressElement>('engine-progress'),

  tutorialTitle: need<HTMLElement>('tutorial-title'),
  tutorialDescription: need<HTMLElement>('tutorial-description'),
  tutorialHint: need<HTMLElement>('tutorial-hint'),
  tutorialTargetCanvas: need<HTMLCanvasElement>('tutorial-target-canvas'),
  tutorialAttemptCanvas: need<HTMLCanvasElement>('tutorial-attempt-canvas'),
  tutorialRegistration: need<HTMLElement>('tutorial-registration'),
  tutorialInput: need<HTMLTextAreaElement>('tutorial-input'),
  tutorialStatus: need<HTMLElement>('tutorial-status'),
  tutorialStatusText: need<HTMLElement>('tutorial-status-text'),
  tutorialSkip: need<HTMLButtonElement>('tutorial-skip'),
  tutorialContinue: need<HTMLButtonElement>('tutorial-continue'),

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
let tutorialComplete = hasCompletedTutorial(storage);

const game = new Game(problems);

// A short round is handy when checking the end screen. Dev only, so the shipped
// game always runs the full three minutes.
if (import.meta.env.DEV) {
  const seconds = Number(new URLSearchParams(location.search).get('seconds'));
  if (Number.isFinite(seconds) && seconds > 0) game.roundSeconds = seconds;
}

const engine = new TexEngine();
const checker = new AttemptChecker(engine, onCheckOutcome);
const tutorialChecker = new AttemptChecker(engine, onTutorialOutcome);

let clockTimer: ReturnType<typeof setInterval> | undefined;
/** Guards against a late compile scoring a problem twice. */
let awaitingAdvance = false;
const warmStartedAt = performance.now();
let warmDetail = 'Checking the browser cache';
let warmPercent = 5;
const warmClock = setInterval(() => {
  if (engine.stage === 'loading') renderWarmProgress();
}, 1_000);

// ------------------------------------------------------------------- engine

engine.onStageChange = (stage, detail, percent) => {
  if (stage === 'ready') {
    clearInterval(warmClock);
    ui.start.disabled = false;
    ui.start.textContent = tutorialComplete ? 'Start the clock' : 'Try a warm-up';
    ui.engineProgress.value = 100;
    const seconds = (performance.now() - warmStartedAt) / 1_000;
    const duration = seconds < 1 ? 'under a second' : `${seconds.toFixed(1)}s`;
    ui.engineStatus.textContent = `TeX Live ready in ${duration}.`;
    ui.engineNote.textContent =
      'This browser will reuse the engine files when storage is available.';
  } else if (stage === 'failed') {
    clearInterval(warmClock);
    ui.start.textContent = 'Engine unavailable';
    ui.engineStatus.textContent = `Could not load the TeX engine: ${detail ?? 'unknown error'}. Reload to try again.`;
    ui.engineNote.textContent = 'Check the connection and browser storage, then reload.';
    telemetry.report({ event: 'engine_warm_failed', reason: classifyError(detail) });
  } else if (stage === 'loading' && detail) {
    warmDetail = detail;
    warmPercent = Math.max(warmPercent, percent ?? warmPercent);
    renderWarmProgress();
  }
};

function renderWarmProgress(): void {
  const seconds = Math.floor((performance.now() - warmStartedAt) / 1_000);
  const elapsed = seconds > 0 ? ` · ${seconds}s` : '';
  ui.engineProgress.value = warmPercent;
  ui.engineStatus.textContent = `${warmDetail} · ${warmPercent}%${elapsed}`;
  ui.engineNote.textContent =
    `First visit: about ${FIRST_VISIT_MB} MB. Later visits reuse browser storage.`;
}

// Download and warm behind the intro screen, so the wait overlaps with reading.
void engine.warm().catch(() => {
  /* Surfaced through onStageChange. */
});

// Then keep fetching the bundles only some problems need, so drawing one of
// those does not stall the clock. Start is not gated on this.
engine.preload(PRELOAD_BUNDLES);

renderBest();

// --------------------------------------------------------------- transitions

function show(screen: 'intro' | 'tutorial' | 'play' | 'end'): void {
  ui.intro.hidden = screen !== 'intro';
  ui.tutorial.hidden = screen !== 'tutorial';
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

function beginFromIntro(): void {
  if (tutorialComplete) startRun();
  else void startTutorial();
}

async function startTutorial(): Promise<void> {
  show('tutorial');
  ui.tutorialTitle.textContent = TUTORIAL.title;
  ui.tutorialDescription.textContent = TUTORIAL.description;
  ui.tutorialHint.textContent = TUTORIAL.latex;
  ui.tutorialInput.value = '';
  ui.tutorialInput.disabled = true;
  ui.tutorialContinue.disabled = true;
  ui.tutorialContinue.textContent = 'Match the target to continue';
  clearCanvas(ui.tutorialTargetCanvas);
  clearCanvas(ui.tutorialAttemptCanvas);
  setTutorialStatus('compiling', 'Preparing the warm-up target');

  const target = await tutorialChecker.setProblem(TUTORIAL.latex);
  if (ui.tutorial.hidden) return;
  if (!target) {
    telemetry.report({ event: 'target_compile_failed', problem: 'tutorial' });
    setTutorialStatus('invalid', 'Warm-up unavailable. Start the timed run instead.');
    ui.tutorialContinue.disabled = false;
    ui.tutorialContinue.textContent = 'Start the timed run';
    return;
  }

  paint(ui.tutorialTargetCanvas, target);
  ui.tutorialInput.disabled = false;
  setTutorialStatus('idle');
  ui.tutorialInput.focus();
}

function rememberTutorial(): void {
  tutorialComplete = true;
  completeTutorial(storage);
}

function leaveTutorial(): void {
  tutorialChecker.cancel();
  rememberTutorial();
  startRun();
}

function startRun(): void {
  tutorialChecker.cancel();
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
    telemetry.report({ event: 'target_compile_failed', problem: problem.id });
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

function setTutorialStatus(status: CheckStatus, override?: string): void {
  ui.tutorialStatusText.textContent = override ?? STATUS_TEXT[status];
  ui.tutorialStatus.className = `status is-${status}`;
  ui.tutorialRegistration.className = `registration is-${status}`;
}

function onTutorialOutcome({
  status,
  image,
}: {
  status: CheckStatus;
  image?: ImageData;
}): void {
  if (ui.tutorial.hidden) return;
  setTutorialStatus(status);
  if (image) paint(ui.tutorialAttemptCanvas, image);
  else if (status === 'idle' || status === 'invalid') clearCanvas(ui.tutorialAttemptCanvas);

  if (status === 'timeout') telemetry.report({ event: 'compile_timeout' });
  if (status === 'match') {
    ui.tutorialInput.disabled = true;
    rememberTutorial();
    ui.tutorialContinue.disabled = false;
    ui.tutorialContinue.textContent = 'Start the three-minute run';
    ui.tutorialContinue.focus();
  }
}

function onCheckOutcome({ status, image }: { status: CheckStatus; image?: ImageData }): void {
  if (game.status !== 'running' || awaitingAdvance) return;

  setStatus(status);
  if (image) paint(ui.attemptCanvas, image);
  else if (status === 'idle' || status === 'invalid') clearCanvas(ui.attemptCanvas);

  if (status === 'timeout') telemetry.report({ event: 'compile_timeout' });
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

ui.start.addEventListener('click', beginFromIntro);
ui.again.addEventListener('click', startRun);

ui.tutorialInput.addEventListener('input', () => {
  tutorialChecker.update(ui.tutorialInput.value);
});

ui.tutorialSkip.addEventListener('click', leaveTutorial);
ui.tutorialContinue.addEventListener('click', leaveTutorial);

ui.input.addEventListener('input', () => {
  if (game.status !== 'running' || awaitingAdvance) return;
  checker.update(ui.input.value);
});

ui.skip.addEventListener('click', () => {
  if (game.status !== 'running' || awaitingAdvance) return;
  advance(() => game.skip());
});

// A tab in the editor should indent, not leave for the Skip button.
function indentEditor(
  event: KeyboardEvent,
  input: HTMLTextAreaElement,
  attemptChecker: AttemptChecker,
): void {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = input;
  input.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  input.selectionStart = input.selectionEnd = selectionStart + 2;
  attemptChecker.update(input.value);
}

ui.input.addEventListener('keydown', (event) => {
  indentEditor(event, ui.input, checker);
});

ui.tutorialInput.addEventListener('keydown', (event) => {
  indentEditor(event, ui.tutorialInput, tutorialChecker);
});
