import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function loadHabitHistoryModule() {
  const source = readFileSync(
    new URL('../lib/habit-history.ts', import.meta.url),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
  );
}

test('migrates v1 completion data into dated history without dropping old days', async () => {
  const { normalizeHabitStore } = await loadHabitHistoryModule();
  const migrated = normalizeHabitStore({
    version: 1,
    habits: [
      {
        id: 'drink-water',
        name: '喝水',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
      { id: 'read', name: '读书', createdAt: '2026-09-01T08:00:00.000Z' },
    ],
    completionDate: '2026-09-04',
    completedHabitIds: ['drink-water', 'missing-id', 'drink-water'],
  });

  assert.deepEqual(migrated, {
    version: 2,
    habits: [
      {
        id: 'drink-water',
        name: '喝水',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
      { id: 'read', name: '读书', createdAt: '2026-09-01T08:00:00.000Z' },
    ],
    history: {
      '2026-09-04': ['drink-water'],
    },
  });
});

test('updates today while preserving previous date history', async () => {
  const { getCompletedHabitIdsForDate, setHabitCompletionForDate } =
    await loadHabitHistoryModule();
  const store = {
    version: 2,
    habits: [
      {
        id: 'drink-water',
        name: '喝水',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
      { id: 'read', name: '读书', createdAt: '2026-09-01T08:00:00.000Z' },
    ],
    history: {
      '2026-09-04': ['drink-water', 'read'],
    },
  };

  const updated = setHabitCompletionForDate(
    store,
    '2026-09-05',
    'drink-water',
    true,
  );

  assert.deepEqual(getCompletedHabitIdsForDate(updated, '2026-09-04'), [
    'drink-water',
    'read',
  ]);
  assert.deepEqual(getCompletedHabitIdsForDate(updated, '2026-09-05'), [
    'drink-water',
  ]);
});

test('calculates current streak from consecutive fully completed days', async () => {
  const { getCurrentStreak } = await loadHabitHistoryModule();
  const store = {
    version: 2,
    habits: [
      {
        id: 'drink-water',
        name: '喝水',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
      { id: 'read', name: '读书', createdAt: '2026-09-03T08:00:00.000Z' },
    ],
    history: {
      '2026-09-02': ['drink-water'],
      '2026-09-03': ['drink-water', 'read'],
      '2026-09-04': ['drink-water', 'read'],
      '2026-09-05': ['drink-water', 'read'],
    },
  };

  assert.equal(getCurrentStreak(store, '2026-09-05'), 4);
});

test('returns a seven day overview with complete, partial, and empty states', async () => {
  const { getRecentCompletionOverview } = await loadHabitHistoryModule();
  const store = {
    version: 2,
    habits: [
      {
        id: 'drink-water',
        name: '喝水',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
      { id: 'read', name: '读书', createdAt: '2026-09-01T08:00:00.000Z' },
    ],
    history: {
      '2026-09-03': ['drink-water'],
      '2026-09-04': ['drink-water', 'read'],
    },
  };

  const overview = getRecentCompletionOverview(store, '2026-09-05');

  assert.equal(overview.length, 7);
  assert.deepEqual(
    overview.map((day) => [
      day.dateKey,
      day.state,
      day.completedCount,
      day.totalCount,
    ]),
    [
      ['2026-08-30', 'empty', 0, 0],
      ['2026-08-31', 'empty', 0, 0],
      ['2026-09-01', 'empty', 0, 2],
      ['2026-09-02', 'empty', 0, 2],
      ['2026-09-03', 'partial', 1, 2],
      ['2026-09-04', 'complete', 2, 2],
      ['2026-09-05', 'empty', 0, 2],
    ],
  );
});

test('page keeps the compact Chinese history surface', () => {
  const page = readFileSync(
    new URL('../app/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(page, /当前连续/);
  assert.match(page, /近 7 天/);
  assert.match(page, /最近 7 天完成概览/);
  assert.match(page, /每天自动记录历史/);
});
