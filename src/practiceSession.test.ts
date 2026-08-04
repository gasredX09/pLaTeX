import { describe, expect, it } from 'vitest';
import { practiceProblems } from './practiceProblems.js';
import { PracticeSession } from './practiceSession.js';

const deck = practiceProblems.slice(0, 3);

describe('PracticeSession', () => {
  it('runs once through an ordered finite set', () => {
    const session = new PracticeSession(deck);
    session.start();
    expect(session.current).toBe(deck[0]);
    session.solve();
    expect(session.current).toBe(deck[1]);
    session.solve();
    session.solve();
    expect(session.status).toBe('complete');
    expect(session.completed).toEqual(deck);
  });

  it('returns a skipped exercise once at the end', () => {
    const session = new PracticeSession(deck);
    session.start();
    session.skip();
    session.solve();
    session.solve();
    expect(session.current).toBe(deck[0]);
    session.solve();
    expect(session.status).toBe('complete');
    expect(session.completed).toEqual([deck[1], deck[2], deck[0]]);
    expect(session.leftForLater).toEqual([]);
  });

  it('finishes when an exercise is skipped again during review', () => {
    const session = new PracticeSession(deck.slice(0, 1));
    session.start();
    session.skip();
    expect(session.status).toBe('running');
    session.skip();
    expect(session.status).toBe('complete');
    expect(session.leftForLater).toEqual([deck[0]]);
  });

  it('handles an empty continuation quietly', () => {
    const session = new PracticeSession([]);
    session.start();
    expect(session.status).toBe('complete');
  });
});
