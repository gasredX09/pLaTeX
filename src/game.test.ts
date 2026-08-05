import { describe, it, expect } from 'vitest';
import { Game, ROUND_SECONDS, formatClock, shuffled } from './game.js';
import type { Problem } from './problems.js';

function problem(id: string, latex: string): Problem {
  return { id, title: id, description: '', latex };
}

/** Three problems worth 1, 2 and 3 points respectively. */
const deck: Problem[] = [
  problem('a', 'x'.repeat(5)),
  problem('b', 'x'.repeat(15)),
  problem('c', 'x'.repeat(25)),
];

/** Deterministic stand-in for Math.random that leaves order untouched. */
const noShuffle = () => 0;

describe('shuffled', () => {
  it('preserves the elements and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffled(input, () => 0.5);
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Game', () => {
  it('starts idle and does not accept play', () => {
    const game = new Game(deck, noShuffle);
    expect(game.status).toBe('idle');
    game.solve();
    expect(game.score).toBe(0);
  });

  it('banks points on solve and moves on', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    const first = game.current;
    const worth = game.currentPoints;
    game.solve();
    expect(game.score).toBe(worth);
    expect(game.solved).toEqual([{ problem: first, points: worth }]);
    expect(game.current).not.toBe(first);
  });

  it('scores nothing for a skip but still moves on', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    const first = game.current;
    game.skip();
    expect(game.score).toBe(0);
    expect(game.skipped).toEqual([first]);
    expect(game.current).not.toBe(first);
  });

  it('wraps around rather than running out of problems', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    const first = game.current;
    for (let i = 0; i < deck.length; i++) game.skip();
    expect(game.current).toBe(first);
    expect(game.problemNumber).toBe(deck.length + 1);
  });

  it('counts down and ends the run at zero', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    expect(game.secondsLeft).toBe(ROUND_SECONDS);
    expect(game.tick(ROUND_SECONDS - 1)).toBe(false);
    expect(game.secondsLeft).toBe(1);
    expect(game.tick()).toBe(true);
    expect(game.status).toBe('over');
  });

  it('never reports a negative clock', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.tick(ROUND_SECONDS + 30);
    expect(game.secondsLeft).toBe(0);
  });

  it('ignores play once the run is over', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.tick(ROUND_SECONDS);
    const score = game.score;
    game.solve();
    game.skip();
    expect(game.score).toBe(score);
    expect(game.solved).toHaveLength(0);
  });

  it('clears the previous run when restarted', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.solve();
    game.skip();
    game.tick(10);
    game.start();
    expect(game.score).toBe(0);
    expect(game.solved).toHaveLength(0);
    expect(game.skipped).toHaveLength(0);
    expect(game.secondsLeft).toBe(ROUND_SECONDS);
    expect(game.problemNumber).toBe(1);
  });
});

describe('formatClock', () => {
  it('pads the seconds', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(0)).toBe('0:00');
  });
});

describe('ending a run early', () => {
  it('stops the run and zeroes the clock', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.tick(30);
    game.end();
    expect(game.status).toBe('over');
    expect(game.secondsLeft).toBe(0);
  });

  it('keeps the points already earned', () => {
    // Giving up remaining time can only lower a score, so there is nothing to
    // exploit, and discarding earned points would be unkind.
    const game = new Game(deck, noShuffle);
    game.start();
    game.solve();
    const earned = game.score;
    game.end();
    expect(game.score).toBe(earned);
    expect(game.solved).toHaveLength(1);
  });

  it('refuses further play, so a late compile cannot score', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.end();
    const score = game.score;
    game.solve();
    game.skip();
    expect(game.score).toBe(score);
    expect(game.solved).toHaveLength(0);
  });

  it('does nothing to a run that never started or already ended', () => {
    const idle = new Game(deck, noShuffle);
    idle.end();
    expect(idle.status).toBe('idle');

    const finished = new Game(deck, noShuffle);
    finished.start();
    finished.tick(ROUND_SECONDS);
    finished.end();
    expect(finished.status).toBe('over');
  });

  it('is undone by starting again', () => {
    const game = new Game(deck, noShuffle);
    game.start();
    game.end();
    game.start();
    expect(game.status).toBe('running');
    expect(game.secondsLeft).toBe(ROUND_SECONDS);
  });
});
