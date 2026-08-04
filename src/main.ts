/**
 * Wires the game to the page: screen transitions, the clock, and the loop from
 * keystroke to verdict.
 */
import './styles.css';
import { Game, formatClock, shuffled } from './game.js';
import { blazeProblems, type Problem } from './problems.js';
import {
  practiceProblems,
  practiceTopics,
  problemsForTopic,
  type PracticeProblem,
  type PracticeTopic,
} from './practiceProblems.js';
import { PracticeSession } from './practiceSession.js';
import {
  buildFixitRound,
  candidateBreaks,
  FIXIT_ROUND_SIZE,
  type BrokenProblem,
} from './fixit.js';
import {
  completePracticeProblem,
  progressForTopic,
  readPracticeProgress,
} from './practiceProgress.js';
import { formatPoints } from './scoring.js';
import { TexEngine } from './tex/engine.js';
import { PRELOAD_BUNDLES } from './tex/document.js';
import { FIRST_VISIT_MB } from './tex/warmProgress.js';
import { AttemptChecker, type CheckStatus, type CheckOutcome } from './tex/compileQueue.js';
import type { TexError } from './tex/explainError.js';
import { planKey, planIndent } from './editor/autoPairs.js';
import { applyEdit } from './editor/textareaEdit.js';
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
  topics: need<HTMLElement>('topics'),
  tutorial: need<HTMLElement>('tutorial'),
  play: need<HTMLElement>('play'),
  end: need<HTMLElement>('end'),
  practiceEnd: need<HTMLElement>('practice-end'),

  practiceMode: need<HTMLButtonElement>('practice-mode'),
  blazeMode: need<HTMLButtonElement>('blaze-mode'),
  fixitMode: need<HTMLButtonElement>('fixit-mode'),
  engineStatus: need<HTMLParagraphElement>('engine-status'),
  engineNote: need<HTMLParagraphElement>('engine-note'),
  engineProgress: need<HTMLProgressElement>('engine-progress'),

  topicList: need<HTMLElement>('topic-list'),
  topicsHome: need<HTMLButtonElement>('topics-home'),

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
  tutorialNote: need<HTMLElement>('tutorial-note'),

  blazeRail: need<HTMLElement>('blaze-rail'),
  practiceRail: need<HTMLElement>('practice-rail'),
  practiceTopicLabel: need<HTMLElement>('practice-topic-label'),
  practiceProgressText: need<HTMLElement>('practice-progress-text'),
  practiceProgressFill: need<HTMLElement>('practice-progress-fill'),
  practiceExit: need<HTMLButtonElement>('practice-exit'),

  clock: need<HTMLElement>('clock'),
  clockFill: need<HTMLElement>('clock-fill'),
  score: need<HTMLElement>('score'),

  problemNumber: need<HTMLElement>('problem-number'),
  problemPoints: need<HTMLElement>('problem-points'),
  problemTitle: need<HTMLElement>('problem-title'),
  problemDescription: need<HTMLElement>('problem-description'),

  practiceTools: need<HTMLElement>('practice-tools'),
  practiceHint: need<HTMLButtonElement>('practice-hint'),
  practiceReveal: need<HTMLButtonElement>('practice-reveal'),
  practiceHintText: need<HTMLElement>('practice-hint-text'),
  practiceSolution: need<HTMLElement>('practice-solution'),
  practiceSolutionCode: need<HTMLElement>('practice-solution-code'),

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
  endHome: need<HTMLButtonElement>('end-home'),

  practiceFinalTitle: need<HTMLElement>('practice-final-title'),
  practiceFinalSummary: need<HTMLElement>('practice-final-summary'),
  practiceCompletedList: need<HTMLUListElement>('practice-completed-list'),
  practiceLaterList: need<HTMLUListElement>('practice-later-list'),
  practiceAgain: need<HTMLButtonElement>('practice-again'),
  practiceAnother: need<HTMLButtonElement>('practice-another'),
  practiceHome: need<HTMLButtonElement>('practice-home'),

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
let practiceProgress = readPracticeProgress(storage);

const game = new Game(blazeProblems);
let practiceSession: PracticeSession | null = null;
let selectedTopic: PracticeTopic | null = null;

type ActiveMode = 'blaze' | 'practice' | 'fixit';
type PendingStart =
  | { mode: 'blaze' }
  | { mode: 'practice'; topic: PracticeTopic }
  | { mode: 'fixit' };

let activeMode: ActiveMode | null = null;
let pendingStart: PendingStart | null = null;
/** Fix-it reuses the untimed queue, over broken problems instead of exercises. */
let fixitSession: PracticeSession<BrokenProblem> | null = null;
/** Repairs in the current round, for the progress rail. */
let fixitRoundTotal = 0;

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
    ui.practiceMode.disabled = false;
    ui.blazeMode.disabled = false;
    ui.fixitMode.disabled = false;
    ui.engineProgress.value = 100;
    const seconds = (performance.now() - warmStartedAt) / 1_000;
    const duration = seconds < 1 ? 'under a second' : `${seconds.toFixed(1)}s`;
    ui.engineStatus.textContent = `TeX Live ready in ${duration}.`;
    ui.engineNote.textContent =
      'This browser will reuse the engine files when storage is available.';
  } else if (stage === 'failed') {
    clearInterval(warmClock);
    ui.practiceMode.disabled = true;
    ui.blazeMode.disabled = true;
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

renderBest();
renderTopics();

// --------------------------------------------------------------- transitions

type Screen = 'intro' | 'topics' | 'tutorial' | 'play' | 'end' | 'practice-end';

function show(screen: Screen): void {
  ui.intro.hidden = screen !== 'intro';
  ui.topics.hidden = screen !== 'topics';
  ui.tutorial.hidden = screen !== 'tutorial';
  ui.play.hidden = screen !== 'play';
  ui.end.hidden = screen !== 'end';
  ui.practiceEnd.hidden = screen !== 'practice-end';
}

/** Shows the standing record wherever it appears, or hides it if there is none. */
function renderBest(): void {
  ui.introBest.hidden = !best;
  ui.railBest.hidden = !best;
  if (!best) return;
  ui.introBestValue.textContent = describeBest(best);
  ui.railBest.textContent = String(best.score);
}

function renderTopics(): void {
  ui.topicList.replaceChildren();
  for (const topic of practiceTopics) {
    const progress = progressForTopic(topic.id, practiceProgress, practiceProblems);
    const button = document.createElement('button');
    button.className = 'topic-card';
    button.type = 'button';
    button.dataset.topic = topic.id;
    button.setAttribute(
      'aria-label',
      `${topic.title}, ${progress.completed} of ${progress.total} complete`,
    );

    const title = document.createElement('span');
    title.className = 'topic-card-title';
    title.textContent = topic.title;

    const count = document.createElement('span');
    count.className = 'topic-card-progress';
    count.textContent = `${progress.completed}/${progress.total}`;

    const description = document.createElement('span');
    description.className = 'topic-card-description';
    description.textContent = topic.description;

    button.append(title, count, description);
    button.addEventListener('click', () => choosePracticeTopic(topic));
    ui.topicList.append(button);
  }
}

function openTopics(): void {
  clearInterval(clockTimer);
  checker.cancel();
  pendingStart = null;
  activeMode = null;
  practiceSession = null;
  renderTopics();
  show('topics');
  ui.topicList.querySelector<HTMLButtonElement>('button')?.focus();
}

function returnHome(): void {
  clearInterval(clockTimer);
  checker.cancel();
  tutorialChecker.cancel();
  pendingStart = null;
  activeMode = null;
  selectedTopic = null;
  practiceSession = null;
  renderBest();
  renderTopics();
  show('intro');
  ui.practiceMode.focus();
}

function chooseBlaze(): void {
  pendingStart = { mode: 'blaze' };
  engine.preload(PRELOAD_BUNDLES);
  if (tutorialComplete) continuePendingStart();
  else void startTutorial();
}

function chooseFixit(): void {
  pendingStart = { mode: 'fixit' };
  // The round is drawn from the Blaze catalog, which includes TikZ problems.
  engine.preload(PRELOAD_BUNDLES);
  if (tutorialComplete) continuePendingStart();
  else void startTutorial();
}

function choosePracticeTopic(topic: PracticeTopic): void {
  pendingStart = { mode: 'practice', topic };
  if (topic.id === 'tikz') engine.preload(PRELOAD_BUNDLES);
  if (tutorialComplete) continuePendingStart();
  else void startTutorial();
}

async function startTutorial(): Promise<void> {
  const destination = pendingStart;
  if (!destination) {
    returnHome();
    return;
  }
  show('tutorial');
  ui.tutorialTitle.textContent = TUTORIAL.title;
  ui.tutorialDescription.textContent = TUTORIAL.description;
  ui.tutorialHint.textContent = TUTORIAL.latex;
  ui.tutorialInput.value = '';
  ui.tutorialInput.disabled = true;
  ui.tutorialContinue.disabled = true;
  ui.tutorialContinue.textContent = 'Match the target to continue';
  ui.tutorialNote.textContent = {
    practice: 'Practice Mode has no timer.',
    fixit: 'Fix-it Mode has no timer either.',
    blaze: 'The Blaze Mode clock starts after this warm-up.',
  }[destination.mode];
  clearCanvas(ui.tutorialTargetCanvas);
  clearCanvas(ui.tutorialAttemptCanvas);
  setTutorialStatus('compiling', 'Preparing the warm-up target');

  const target = await tutorialChecker.setProblem(TUTORIAL.latex);
  if (ui.tutorial.hidden) return;
  if (!target) {
    telemetry.report({ event: 'target_compile_failed', problem: 'tutorial' });
    setTutorialStatus('invalid', 'Warm-up unavailable. Continue to your selected mode.');
    ui.tutorialContinue.disabled = false;
    ui.tutorialContinue.textContent = continueLabel(destination.mode);
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
  continuePendingStart();
}

function continuePendingStart(): void {
  const destination = pendingStart;
  pendingStart = null;
  if (!destination) returnHome();
  else if (destination.mode === 'blaze') startBlaze();
  else if (destination.mode === 'fixit') startFixit();
  else startPractice(destination.topic);
}

function startBlaze(): void {
  tutorialChecker.cancel();
  activeMode = 'blaze';
  selectedTopic = null;
  practiceSession = null;
  game.start();
  configurePlayScreen('blaze');
  show('play');
  renderBest();
  renderBlazeRail();
  void loadCurrentProblem();

  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (game.tick()) finishBlaze();
    renderBlazeRail();
  }, 1000);

  ui.input.focus();
}

function startPractice(topic: PracticeTopic): void {
  tutorialChecker.cancel();
  clearInterval(clockTimer);
  activeMode = 'practice';
  selectedTopic = topic;

  const all = problemsForTopic(topic.id);
  const unfinished = all.filter((problem) => !practiceProgress.has(problem.id));
  practiceSession = new PracticeSession(unfinished.length > 0 ? unfinished : all);
  practiceSession.start();

  configurePlayScreen('practice');
  show('play');
  renderPracticeRail();
  void loadCurrentProblem();
}

function continueLabel(mode: ActiveMode): string {
  return {
    practice: 'Begin Practice Mode',
    fixit: 'Begin Fix-it Mode',
    blaze: 'Start Blaze Mode',
  }[mode];
}

function startFixit(): void {
  tutorialChecker.cancel();
  clearInterval(clockTimer);
  activeMode = 'fixit';
  selectedTopic = null;
  practiceSession = null;

  const round = buildFixitRound(shuffled(blazeProblems), FIXIT_ROUND_SIZE);
  fixitRoundTotal = round.length;
  fixitSession = new PracticeSession(round);
  fixitSession.start();

  configurePlayScreen('fixit');
  show('play');
  renderFixitRail();
  void loadCurrentProblem();
}

function configurePlayScreen(mode: ActiveMode): void {
  const timed = mode === 'blaze';
  ui.blazeRail.hidden = !timed;
  // Fix-it borrows the untimed rail, relabelled by renderFixitRail.
  ui.practiceRail.hidden = timed;
  ui.problemPoints.hidden = !timed;
  // Both untimed modes offer the source as a last resort. Only Practice has a
  // conceptual hint; Blaze problems, which Fix-it draws from, carry none.
  ui.practiceTools.hidden = timed;
  // Both untimed modes defer a skipped item to the end of the round.
  ui.skip.textContent = timed ? 'Skip' : 'Later';
  // The shared rail's exit leads back to wherever the mode was entered from,
  // and Fix-it was not entered from the topic list.
  ui.practiceExit.textContent = mode === 'fixit' ? 'Choose a mode' : 'Choose topic';
}

function finishBlaze(): void {
  clearInterval(clockTimer);
  checker.cancel();
  ui.input.disabled = true;
  renderBlazeEnd();
  show('end');
  ui.again.focus();
}

function finishPractice(): void {
  checker.cancel();
  ui.input.disabled = true;
  ui.practiceAgain.textContent = 'Practice this topic again';
  ui.practiceAnother.hidden = false;
  renderPracticeEnd();
  show('practice-end');
  ui.practiceAgain.focus();
}

// ------------------------------------------------------------------ drawing

function renderBlazeRail(): void {
  ui.clock.textContent = formatClock(game.secondsLeft);
  ui.score.textContent = String(game.score);
  const remaining = (game.secondsLeft / game.roundSeconds) * 100;
  ui.clockFill.style.width = `${remaining}%`;
  ui.clockFill.classList.toggle('urgent', game.secondsLeft <= 30);
}

function renderPracticeRail(): void {
  const topic = selectedTopic;
  if (!topic) return;
  const progress = progressForTopic(topic.id, practiceProgress, practiceProblems);
  ui.practiceTopicLabel.textContent = topic.title;
  ui.practiceProgressText.textContent = `${progress.completed} of ${progress.total} complete`;
  ui.practiceProgressFill.style.width = `${(progress.completed / progress.total) * 100}%`;
}

function renderFixitRail(): void {
  const repaired = fixitSession?.completed.length ?? 0;
  ui.practiceTopicLabel.textContent = 'Fix-it';
  ui.practiceProgressText.textContent = `${repaired} of ${fixitRoundTotal} repaired`;
  const fraction = fixitRoundTotal > 0 ? repaired / fixitRoundTotal : 0;
  ui.practiceProgressFill.style.width = `${fraction * 100}%`;
}

function activeProblem(): Problem | null {
  if (activeMode === 'blaze' && game.status === 'running') return game.current;
  if (activeMode === 'practice' && practiceSession?.status === 'running') {
    return practiceSession.current;
  }
  if (activeMode === 'fixit' && fixitSession?.status === 'running') {
    return fixitSession.current.problem;
  }
  return null;
}

async function loadCurrentProblem(): Promise<void> {
  const problem = activeProblem();
  if (!problem) return;
  awaitingAdvance = false;

  if (activeMode === 'blaze') {
    ui.problemNumber.textContent = `Problem ${game.problemNumber}`;
    ui.problemPoints.textContent = formatPoints(game.currentPoints);
  } else if (activeMode === 'fixit') {
    const repaired = fixitSession?.completed.length ?? 0;
    ui.problemNumber.textContent = `Repair ${repaired + 1} of ${fixitRoundTotal}`;
    resetFixitTools(problem);
  } else {
    const practiceProblem = problem as PracticeProblem;
    const topicProblems = problemsForTopic(practiceProblem.topic);
    const exercise = topicProblems.findIndex((candidate) => candidate.id === problem.id) + 1;
    ui.problemNumber.textContent = `Exercise ${exercise} of ${topicProblems.length}`;
    resetPracticeTools(practiceProblem);
  }
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
  // The session may have ended, or the player may have skipped, while this compiled.
  if (activeProblem() !== problem) return;

  if (!target) {
    telemetry.report({ event: 'target_compile_failed', problem: problem.id });
    setStatus('invalid', 'This problem failed to compile. Skipping.');
    advanceActive('skip');
    return;
  }
  paint(ui.targetCanvas, target);

  if (activeMode === 'fixit') {
    // The editor starts wrong on purpose. Which mutation to use cannot be
    // decided from the text alone, since some compile and still typeset the
    // target exactly, so candidates are compiled against the target just
    // rendered and the first genuinely wrong one is used.
    const candidates = candidateBreaks(problem);
    const chosen = (await checker.pickBrokenSource(candidates)) ?? candidates[0] ?? null;
    if (activeProblem() !== problem) return;

    if (!chosen) {
      // The verifier proves every problem has a playable mutation, so this is
      // unreachable; skipping beats showing an already-correct puzzle.
      telemetry.report({ event: 'target_compile_failed', problem: problem.id });
      advanceActive('skip');
      return;
    }
      // Capitalized, since it stands alone as a sentence in the hint slot.
    const summary = chosen.mutator.summary;
    ui.practiceHintText.textContent = `${summary[0]!.toUpperCase()}${summary.slice(1)}.`;
    ui.input.value = chosen.source;
    ui.input.disabled = false;
    ui.input.focus();
    // Render the broken source at once, so the fault is visible beside the
    // target rather than only after the first keystroke.
    checker.update(chosen.source);
    return;
  }

  ui.input.disabled = false;
  ui.input.focus();
}

/**
 * Blaze problems carry no authored hint, but the mutator knows exactly what it
 * broke, so Fix-it can say what kind of fault to look for without giving away
 * where it is. Set once the mutation has been chosen.
 */
function resetFixitTools(problem: Problem): void {
  ui.practiceHintText.textContent = '';
  ui.practiceHintText.hidden = true;
  ui.practiceHint.textContent = 'Show hint';
  ui.practiceSolutionCode.textContent = problem.latex;
  ui.practiceSolution.hidden = true;
  ui.practiceReveal.textContent = 'Reveal source';
}

function resetPracticeTools(problem: PracticeProblem): void {
  ui.practiceHintText.textContent = problem.hint;
  ui.practiceHintText.hidden = true;
  ui.practiceSolutionCode.textContent = problem.latex;
  ui.practiceSolution.hidden = true;
  ui.practiceHint.textContent = 'Show hint';
  ui.practiceReveal.textContent = 'Reveal source';
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

/**
 * "Does not compile" on its own leaves a player with nowhere to go, which is the
 * whole reason the TeX log is captured. When the failure is understood, say what
 * to change; keep TeX's own wording in the tooltip for anyone who wants it.
 */
function describeStatus(status: CheckStatus, error?: TexError | null): string {
  if (status !== 'invalid' || !error) return STATUS_TEXT[status];
  return `Does not compile: ${error.message}`;
}

function setStatus(status: CheckStatus, override?: string, error?: TexError | null): void {
  ui.statusText.textContent = override ?? describeStatus(status, error);
  ui.statusText.title = error?.raw ?? '';
  ui.status.className = `status is-${status}`;
  ui.registration.className = `registration is-${status}`;
}

function setTutorialStatus(status: CheckStatus, override?: string, error?: TexError | null): void {
  ui.tutorialStatusText.textContent = override ?? describeStatus(status, error);
  ui.tutorialStatusText.title = error?.raw ?? '';
  ui.tutorialStatus.className = `status is-${status}`;
  ui.tutorialRegistration.className = `registration is-${status}`;
}

function onTutorialOutcome({ status, image, error }: CheckOutcome): void {
  if (ui.tutorial.hidden) return;
  setTutorialStatus(status, undefined, error);
  if (image) paint(ui.tutorialAttemptCanvas, image);
  else if (status === 'idle' || status === 'invalid') clearCanvas(ui.tutorialAttemptCanvas);

  if (status === 'timeout') telemetry.report({ event: 'compile_timeout' });
  if (status === 'match') {
    ui.tutorialInput.disabled = true;
    rememberTutorial();
    ui.tutorialContinue.disabled = false;
    ui.tutorialContinue.textContent = continueLabel(pendingStart?.mode ?? 'blaze');
    ui.tutorialContinue.focus();
  }
}

function onCheckOutcome({ status, image, error }: CheckOutcome): void {
  if (!activeProblem() || awaitingAdvance) return;

  setStatus(status, undefined, error);
  if (image) paint(ui.attemptCanvas, image);
  else if (status === 'idle' || status === 'invalid') clearCanvas(ui.attemptCanvas);

  if (status === 'timeout') telemetry.report({ event: 'compile_timeout' });
  if (status === 'match') {
    ui.input.disabled = true;
    advanceActive('solve');
  }
}

/**
 * Applies an outcome and deals the next problem after a short beat, so the
 * locked registration mark is legible before the screen changes.
 */
function advanceActive(outcome: 'solve' | 'skip'): void {
  const mode = activeMode;
  if (!mode) return;
  awaitingAdvance = true;
  checker.cancel();

  if (mode === 'blaze') {
    if (outcome === 'solve') game.solve();
    else game.skip();
    renderBlazeRail();
  } else if (mode === 'fixit') {
    const session = fixitSession;
    if (!session || session.status !== 'running') return;
    if (outcome === 'solve') session.solve();
    else session.skip();
    renderFixitRail();
  } else {
    const session = practiceSession;
    if (!session || session.status !== 'running') return;
    if (outcome === 'solve') {
      practiceProgress = completePracticeProblem(
        storage,
        practiceProgress,
        session.current.id,
      );
      session.solve();
    } else {
      session.skip();
    }
    renderPracticeRail();
    renderTopics();
  }

  setTimeout(() => {
    if (activeMode !== mode) return;
    if (mode === 'blaze' && game.status !== 'running') return;
    if (mode === 'practice' && practiceSession?.status === 'complete') {
      finishPractice();
      return;
    }
    if (mode === 'fixit' && fixitSession?.status === 'complete') {
      finishFixit();
      return;
    }
    void loadCurrentProblem();
  }, 450);
}

function renderBlazeEnd(): void {
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

function finishFixit(): void {
  checker.cancel();
  ui.input.disabled = true;
  renderFixitEnd();
  ui.practiceAgain.textContent = 'Repair another round';
  // Fix-it has no topics, so that route off the shared sheet does not apply.
  ui.practiceAnother.hidden = true;
  show('practice-end');
  ui.practiceAgain.focus();
}

/** Reuses the untimed end sheet, since the shape of the result is the same. */
function renderFixitEnd(): void {
  const session = fixitSession;
  if (!session) return;

  const repaired = session.completed.length;
  ui.practiceFinalTitle.textContent =
    repaired === fixitRoundTotal ? 'Every fault found' : 'Repairs finished';
  ui.practiceFinalSummary.textContent =
    repaired === 0
      ? 'Nothing repaired this round. The source is wrong in exactly one place each time.'
      : `${repaired} of ${fixitRoundTotal} ${repaired === 1 ? 'source' : 'sources'} repaired.`;

  fill(
    ui.practiceCompletedList,
    session.completed.map(({ problem, mutator }) => [problem.title, mutator.summary]),
    'Nothing repaired this round',
  );
  fill(
    ui.practiceLaterList,
    session.leftForLater.map(({ problem }) => [problem.title, '']),
    'Nothing left behind',
  );
}

function renderPracticeEnd(): void {
  const topic = selectedTopic;
  const session = practiceSession;
  if (!topic || !session) return;

  const progress = progressForTopic(topic.id, practiceProgress, practiceProblems);
  const complete = progress.completed === progress.total;
  ui.practiceFinalTitle.textContent = complete ? `${topic.title} complete` : 'Practice paused';
  ui.practiceFinalSummary.textContent = complete
    ? `All ${progress.total} ${topic.title.toLowerCase()} exercises are complete.`
    : `${progress.completed} of ${progress.total} exercises complete. The rest will be waiting for you.`;

  fill(
    ui.practiceCompletedList,
    session.completed.map((problem) => [problem.title, 'complete']),
    'Nothing completed this visit',
  );
  fill(
    ui.practiceLaterList,
    session.leftForLater.map((problem) => [problem.title, '']),
    'Nothing left behind',
  );
  renderTopics();
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

ui.practiceMode.addEventListener('click', openTopics);
ui.blazeMode.addEventListener('click', chooseBlaze);
ui.fixitMode.addEventListener('click', chooseFixit);
ui.topicsHome.addEventListener('click', returnHome);
ui.again.addEventListener('click', startBlaze);
ui.endHome.addEventListener('click', returnHome);
ui.practiceExit.addEventListener('click', () => {
  if (activeMode === 'fixit') returnHome();
  else openTopics();
});
ui.practiceAnother.addEventListener('click', openTopics);
ui.practiceHome.addEventListener('click', returnHome);
ui.practiceAgain.addEventListener('click', () => {
  if (activeMode === 'fixit') startFixit();
  else if (selectedTopic) startPractice(selectedTopic);
});

ui.tutorialInput.addEventListener('input', () => {
  tutorialChecker.update(ui.tutorialInput.value);
});

ui.tutorialSkip.addEventListener('click', leaveTutorial);
ui.tutorialContinue.addEventListener('click', leaveTutorial);

ui.input.addEventListener('input', () => {
  if (!activeProblem() || awaitingAdvance) return;
  checker.update(ui.input.value);
});

ui.skip.addEventListener('click', () => {
  if (!activeProblem() || awaitingAdvance) return;
  advanceActive('skip');
});

ui.practiceHint.addEventListener('click', () => {
  ui.practiceHintText.hidden = !ui.practiceHintText.hidden;
  ui.practiceHint.textContent = ui.practiceHintText.hidden ? 'Show hint' : 'Hide hint';
});

ui.practiceReveal.addEventListener('click', () => {
  ui.practiceSolution.hidden = !ui.practiceSolution.hidden;
  ui.practiceReveal.textContent = ui.practiceSolution.hidden ? 'Reveal source' : 'Hide source';
});

/**
 * Editor keys: Tab indents rather than leaving for the Skip button, and
 * delimiters close themselves.
 *
 * Both go through applyEdit, which performs the change as the user rather than
 * assigning to `value`. That keeps the native undo stack intact, and means the
 * browser fires `input` itself, so the recompile is triggered by the existing
 * listener and must not be triggered again here.
 */
function handleEditorKey(event: KeyboardEvent, input: HTMLTextAreaElement): void {
  // Leave shortcuts and IME composition alone. Cmd-[ is browser navigation, and
  // a composing keystroke is not a finished character yet.
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;

  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault();
    applyEdit(input, planIndent(input));
    return;
  }

  const edit = planKey(input, event.key);
  if (!edit) return;
  event.preventDefault();
  applyEdit(input, edit);
}

for (const editor of [ui.input, ui.tutorialInput]) {
  editor.addEventListener('keydown', (event) => {
    handleEditorKey(event, editor);
  });
}
