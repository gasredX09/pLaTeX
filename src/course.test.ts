import { describe, it, expect } from 'vitest';
import { courseStages, courseExercises, parseProse } from './course.js';
import { blazeProblems } from './problems.js';
import { practiceProblems } from './practiceProblems.js';

describe('the course', () => {
  it('opens with prose and no exercise', () => {
    const first = courseStages[0]!;
    expect(first.exercise).toBeUndefined();
    expect(first.example).toBeUndefined();
    expect(first.body.length).toBeGreaterThan(2);
  });

  it('gives every later stage both a worked example and one exercise', () => {
    for (const stage of courseStages.slice(1)) {
      expect(stage.example?.source, stage.id).toBeTruthy();
      expect(stage.example?.caption, stage.id).toBeTruthy();
      expect(stage.exercise, stage.id).toBeDefined();
      expect(stage.exercise?.hint, stage.id).toBeTruthy();
    }
  });

  it('has one exercise per teaching stage', () => {
    expect(courseExercises).toHaveLength(courseStages.length - 1);
  });

  it('gives every stage prose and a map summary', () => {
    for (const stage of courseStages) {
      expect(stage.title, stage.id).toBeTruthy();
      expect(stage.summary, stage.id).toBeTruthy();
      expect(stage.body.length, stage.id).toBeGreaterThan(0);
      for (const paragraph of stage.body) expect(paragraph.trim(), stage.id).not.toBe('');
    }
  });

  it('uses unique stage and exercise ids', () => {
    const stageIds = courseStages.map((stage) => stage.id);
    expect(new Set(stageIds).size).toBe(stageIds.length);
    const exerciseIds = courseExercises.map((exercise) => exercise.id);
    expect(new Set(exerciseIds).size).toBe(exerciseIds.length);
  });

  it('keeps its exercises distinct from the other two catalogs', () => {
    // Meeting the same target in the tutorial and in Practice would make the
    // tutorial feel like a preview rather than a lesson.
    const otherIds = new Set([...blazeProblems, ...practiceProblems].map((p) => p.id));
    const otherSources = new Set([...blazeProblems, ...practiceProblems].map((p) => p.latex));
    for (const exercise of courseExercises) {
      expect(otherIds.has(exercise.id), exercise.id).toBe(false);
      expect(otherSources.has(exercise.latex), exercise.id).toBe(false);
    }
  });

  it('does not reuse a worked example as its own exercise', () => {
    // The exercise has to ask for something, not just be the example again.
    for (const stage of courseStages.slice(1)) {
      expect(stage.example!.source, stage.id).not.toBe(stage.exercise!.latex);
    }
  });

  it('teaches braces before maths, and maths mode before fractions', () => {
    // \frac is unreadable without braces, and "maths outside maths mode" is the
    // error a beginner hits first, so the order carries the teaching.
    const order = courseStages.map((stage) => stage.id);
    expect(order.indexOf('course-commands')).toBeLessThan(order.indexOf('course-maths-mode'));
    expect(order.indexOf('course-maths-mode')).toBeLessThan(order.indexOf('course-fractions'));
  });

  it('leaves no markdown emphasis in the prose', () => {
    // parseProse only understands backtick code spans; anything else would show
    // its own punctuation to the reader.
    for (const stage of courseStages) {
      for (const paragraph of stage.body) {
        expect(paragraph, stage.id).not.toMatch(/\*\*|__/);
      }
    }
  });

  it('closes every backtick span it opens', () => {
    for (const stage of courseStages) {
      for (const paragraph of stage.body) {
        const ticks = [...paragraph].filter((character) => character === '`').length;
        expect(ticks % 2, `${stage.id}: ${paragraph.slice(0, 40)}`).toBe(0);
      }
    }
  });
});

describe('parseProse', () => {
  it('returns plain text unchanged', () => {
    expect(parseProse('just words')).toEqual([{ kind: 'text', text: 'just words' }]);
  });

  it('splits a code span out of the middle', () => {
    expect(parseProse('use `\\textbf` for bold')).toEqual([
      { kind: 'text', text: 'use ' },
      { kind: 'code', text: '\\textbf' },
      { kind: 'text', text: ' for bold' },
    ]);
  });

  it('handles a span at each end', () => {
    expect(parseProse('`a` and `b`')).toEqual([
      { kind: 'code', text: 'a' },
      { kind: 'text', text: ' and ' },
      { kind: 'code', text: 'b' },
    ]);
  });

  it('treats an unclosed backtick as text rather than swallowing the rest', () => {
    expect(parseProse('a `b c')).toEqual([{ kind: 'text', text: 'a `b c' }]);
  });

  it('handles an empty span', () => {
    expect(parseProse('a `` b')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: '' },
      { kind: 'text', text: ' b' },
    ]);
  });

  it('returns nothing for an empty string', () => {
    expect(parseProse('')).toEqual([]);
  });

  it('keeps markup characters as literal text', () => {
    // The caller builds text nodes from these, so this only documents that no
    // escaping or stripping happens here.
    expect(parseProse('a <b> & c')).toEqual([{ kind: 'text', text: 'a <b> & c' }]);
  });
});

describe('lessons whose point is invisible by default', () => {
  it('restores the indent wherever a paragraph break is the lesson', () => {
    /*
     * The shared preamble zeroes \parindent for deterministic layout, which makes
     * a paragraph break render identically to a line break. Any target relying on
     * one therefore needs the indent restored, or the exercise silently accepts
     * `\\` as correct and teaches the opposite of what it intends.
     */
    for (const stage of courseStages) {
      for (const [what, source, preamble] of [
        ['example', stage.example?.source, stage.example?.preamble],
        ['exercise', stage.exercise?.latex, stage.exercise?.preamble],
      ] as const) {
        if (!source?.includes('\n\n')) continue;
        expect(preamble ?? '', `${stage.id} ${what}`).toContain('parindent');
      }
    }
  });
});
