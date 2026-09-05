export type Habit = {
  id: string;
  name: string;
  createdAt: string;
};

type HabitStoreV1 = {
  version: 1;
  habits: Habit[];
  completionDate: string;
  completedHabitIds: string[];
};

export type HabitStore = {
  version: 2;
  habits: Habit[];
  history: Record<string, string[]>;
};

export type CompletionState = 'complete' | 'partial' | 'empty';

export type DayCompletionOverview = {
  dateKey: string;
  completedCount: number;
  totalCount: number;
  state: CompletionState;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateFromKey(dateKey: string) {
  const [year = '', month = '', day = ''] = dateKey.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function getRecentDateKeys(todayKey: string, days = 7) {
  const today = getDateFromKey(todayKey);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return getLocalDateKey(date);
  });
}

export function createEmptyStore(): HabitStore {
  return {
    version: 2,
    habits: [],
    history: {},
  };
}

function isDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

function isHabit(value: unknown): value is Habit {
  if (!value || typeof value !== 'object') return false;

  const habit = value as Partial<Habit>;
  return (
    typeof habit.id === 'string' &&
    typeof habit.name === 'string' &&
    typeof habit.createdAt === 'string'
  );
}

function isStoreV1(value: unknown): value is HabitStoreV1 {
  if (!value || typeof value !== 'object') return false;

  const store = value as Partial<HabitStoreV1>;
  return (
    store.version === 1 &&
    typeof store.completionDate === 'string' &&
    Array.isArray(store.habits) &&
    store.habits.every(isHabit) &&
    Array.isArray(store.completedHabitIds) &&
    store.completedHabitIds.every((id) => typeof id === 'string')
  );
}

function isStoreV2(value: unknown): value is HabitStore {
  if (!value || typeof value !== 'object') return false;

  const store = value as Partial<HabitStore>;
  return (
    store.version === 2 &&
    Array.isArray(store.habits) &&
    store.habits.every(isHabit) &&
    Boolean(store.history) &&
    typeof store.history === 'object' &&
    !Array.isArray(store.history) &&
    Object.values(store.history).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    )
  );
}

function normalizeCompletedIds(ids: string[], validHabitIds: Set<string>) {
  return [...new Set(ids.filter((id) => validHabitIds.has(id)))];
}

function normalizeHistory(
  history: Record<string, string[]>,
  validHabitIds: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(history)
      .filter(([dateKey]) => isDateKey(dateKey))
      .map(([dateKey, ids]) => [
        dateKey,
        normalizeCompletedIds(ids, validHabitIds),
      ]),
  );
}

export function normalizeHabitStore(value: unknown): HabitStore {
  if (isStoreV2(value)) {
    const validHabitIds = new Set(value.habits.map((habit) => habit.id));

    return {
      version: 2,
      habits: value.habits,
      history: normalizeHistory(value.history, validHabitIds),
    };
  }

  if (isStoreV1(value)) {
    const validHabitIds = new Set(value.habits.map((habit) => habit.id));
    const history = isDateKey(value.completionDate)
      ? {
          [value.completionDate]: normalizeCompletedIds(
            value.completedHabitIds,
            validHabitIds,
          ),
        }
      : {};

    return {
      version: 2,
      habits: value.habits,
      history,
    };
  }

  throw new Error('Invalid habit store');
}

export function getCompletedHabitIdsForDate(
  store: HabitStore,
  dateKey: string,
) {
  return store.history[dateKey] ?? [];
}

function getHabitStartDateKey(habit: Habit) {
  const createdAt = new Date(habit.createdAt);
  if (!Number.isNaN(createdAt.getTime())) return getLocalDateKey(createdAt);
  if (isDateKey(habit.createdAt.slice(0, 10)))
    return habit.createdAt.slice(0, 10);
  return '0000-01-01';
}

function getHabitsForDate(habits: Habit[], dateKey: string) {
  return habits.filter((habit) => getHabitStartDateKey(habit) <= dateKey);
}

export function getCompletionOverviewForDate(
  habits: Habit[],
  completedHabitIds: string[],
  dateKey: string,
): DayCompletionOverview {
  const habitsForDate = getHabitsForDate(habits, dateKey);
  const completedIds = new Set(completedHabitIds);
  const completedCount = habitsForDate.reduce(
    (count, habit) => count + (completedIds.has(habit.id) ? 1 : 0),
    0,
  );
  const totalCount = habitsForDate.length;

  return {
    dateKey,
    completedCount,
    totalCount,
    state:
      totalCount > 0 && completedCount === totalCount
        ? 'complete'
        : completedCount > 0
          ? 'partial'
          : 'empty',
  };
}

export function getRecentCompletionOverview(
  store: HabitStore,
  todayKey: string,
  days = 7,
) {
  return getRecentDateKeys(todayKey, days).map((dateKey) =>
    getCompletionOverviewForDate(
      store.habits,
      getCompletedHabitIdsForDate(store, dateKey),
      dateKey,
    ),
  );
}

export function getCurrentStreak(store: HabitStore, todayKey: string) {
  let streak = 0;
  const cursor = getDateFromKey(todayKey);

  while (true) {
    const dateKey = getLocalDateKey(cursor);
    const overview = getCompletionOverviewForDate(
      store.habits,
      getCompletedHabitIdsForDate(store, dateKey),
      dateKey,
    );

    if (overview.state !== 'complete') return streak;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
}

export function setHabitCompletionForDate(
  store: HabitStore,
  dateKey: string,
  habitId: string,
  checked: boolean,
): HabitStore {
  const completedIds = new Set(getCompletedHabitIdsForDate(store, dateKey));
  if (checked) completedIds.add(habitId);
  else completedIds.delete(habitId);

  return {
    ...store,
    history: {
      ...store.history,
      [dateKey]: [...completedIds],
    },
  };
}

export function removeHabitFromHistory(store: HabitStore, habitId: string) {
  return {
    ...store,
    history: Object.fromEntries(
      Object.entries(store.history).map(([dateKey, ids]) => [
        dateKey,
        ids.filter((id) => id !== habitId),
      ]),
    ),
  };
}
