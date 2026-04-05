import { expect, test } from '@jest/globals';
import {
  calculateMomentum,
  calculateReturn,
  summarizeMomentum,
} from '../utils/momentum.js';

const createCloses = (count, base = 100, step = 1) => (
  Array.from({ length: count }, (_, index) => ({
    date: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
    close: base + (index * step),
  }))
);

test('calculateReturn should calculate percentage return by trading days', () => {
  const closes = createCloses(300, 100, 1);
  const value = calculateReturn(closes, 21);
  expect(value).toBeCloseTo(5.56, 2);
});

test('calculateMomentum should provide all periods and acceleration', () => {
  const closes = createCloses(300, 100, 1);
  const momentum = calculateMomentum(closes);
  expect(momentum.r1m).not.toBeNull();
  expect(momentum.r3m).not.toBeNull();
  expect(momentum.r6m).not.toBeNull();
  expect(momentum.r12m).not.toBeNull();
  expect(momentum.acceleration).toBeCloseTo(momentum.r1m - momentum.r6m, 6);
  expect(momentum.absoluteMomentum).toBe(true);
});

test('summarizeMomentum should evaluate dual momentum and relative momentum', () => {
  const closes = createCloses(300, 100, 1);
  const summary = summarizeMomentum({
    symbol: 'TEST',
    closes,
    benchmarkR12m: 10,
  });

  expect(summary.symbol).toBe('TEST');
  expect(summary.momentum.absoluteMomentum).toBe(true);
  expect(summary.momentum.relativeMomentum).toBe(true);
  expect(summary.momentum.dualMomentum).toBe(true);
});
