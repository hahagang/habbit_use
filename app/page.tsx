'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Leaf,
  Pencil,
  Plus,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  type Habit,
  type HabitStore,
  createEmptyStore,
  getCompletedHabitIdsForDate,
  getCurrentStreak,
  getDateFromKey,
  getLocalDateKey,
  getRecentCompletionOverview,
  normalizeHabitStore,
  removeHabitFromHistory,
  setHabitCompletionForDate,
} from '@/lib/habit-history';

const STORAGE_KEY = 'good-habits:v1';
const MAX_NAME_LENGTH = 30;

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase('zh-CN');
}

function getNameError(name: string, habits: Habit[], excludedId?: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return '请输入习惯名称';
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return `习惯名称不能超过 ${MAX_NAME_LENGTH} 个字符`;
  }

  const normalizedName = normalizeName(trimmedName);
  const isDuplicate = habits.some(
    (habit) =>
      habit.id !== excludedId && normalizeName(habit.name) === normalizedName,
  );
  return isDuplicate ? '这个习惯已经在列表里了' : '';
}

function makeHabitId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const historyDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'short',
});

function getHistoryDayLabel(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return '今天';

  const yesterday = getDateFromKey(todayKey);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === getLocalDateKey(yesterday)) return '昨天';

  return historyDayFormatter.format(getDateFromKey(dateKey));
}

export default function Home() {
  const [store, setStore] = useState<HabitStore>(createEmptyStore);
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());
  const [isHydrated, setIsHydrated] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitError, setNewHabitError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingError, setEditingError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const refreshForToday = useCallback(() => {
    setTodayKey(getLocalDateKey());
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const hydrationTimer = window.setTimeout(() => {
      if (isCancelled) return;

      try {
        const savedValue = window.localStorage.getItem(STORAGE_KEY);
        setTodayKey(getLocalDateKey());
        if (!savedValue) {
          setStore(createEmptyStore());
        } else {
          const parsedValue: unknown = JSON.parse(savedValue);
          setStore(normalizeHabitStore(parsedValue));
        }
      } catch {
        setStore(createEmptyStore());
        setStorageWarning('本地数据无法读取，已为你开启一个新的列表。');
      } finally {
        setIsHydrated(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      window.setTimeout(() => {
        setStorageWarning('当前更改暂时只能保留在本页，刷新后可能会丢失。');
      }, 0);
    }
  }, [isHydrated, store]);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      const delay = nextMidnight.getTime() - now.getTime() + 100;
      midnightTimer = setTimeout(() => {
        refreshForToday();
        scheduleMidnightRefresh();
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshForToday();
    };

    scheduleMidnightRefresh();
    window.addEventListener('focus', refreshForToday);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(midnightTimer);
      window.removeEventListener('focus', refreshForToday);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshForToday]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const todayCompletedHabitIds = useMemo(
    () => getCompletedHabitIdsForDate(store, todayKey),
    [store, todayKey],
  );
  const completedIds = useMemo(
    () => new Set(todayCompletedHabitIds),
    [todayCompletedHabitIds],
  );
  const completedCount = store.habits.reduce(
    (count, habit) => count + (completedIds.has(habit.id) ? 1 : 0),
    0,
  );
  const completionPercent = store.habits.length
    ? Math.round((completedCount / store.habits.length) * 100)
    : 0;
  const allDone =
    store.habits.length > 0 && completedCount === store.habits.length;
  const currentStreak = useMemo(
    () => getCurrentStreak(store, todayKey),
    [store, todayKey],
  );
  const recentOverview = useMemo(
    () => getRecentCompletionOverview(store, todayKey),
    [store, todayKey],
  );
  const completedDaysInRecentOverview = recentOverview.filter(
    (day) => day.state === 'complete',
  ).length;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(getDateFromKey(todayKey));

  const addHabit = () => {
    setTodayKey(getLocalDateKey());
    const error = getNameError(newHabitName, store.habits);
    if (error) {
      setNewHabitError(error);
      return;
    }

    const habit: Habit = {
      id: makeHabitId(),
      name: newHabitName.trim(),
      createdAt: new Date().toISOString(),
    };
    setStore((currentStore) => ({
      ...currentStore,
      habits: [...currentStore.habits, habit],
    }));
    setNewHabitName('');
    setNewHabitError('');
  };

  const toggleHabit = (habitId: string, checked: boolean) => {
    const dateKey = getLocalDateKey();
    setTodayKey(dateKey);
    setStore((currentStore) =>
      setHabitCompletionForDate(currentStore, dateKey, habitId, checked),
    );
  };

  const beginEditing = (habit: Habit) => {
    setEditingId(habit.id);
    setEditingName(habit.name);
    setEditingError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setEditingError('');
  };

  const saveEditing = () => {
    if (!editingId) return;
    const error = getNameError(editingName, store.habits, editingId);
    if (error) {
      setEditingError(error);
      return;
    }

    setStore((currentStore) => ({
      ...currentStore,
      habits: currentStore.habits.map((habit) =>
        habit.id === editingId ? { ...habit, name: editingName.trim() } : habit,
      ),
    }));
    cancelEditing();
  };

  const deleteHabit = (habitId: string) => {
    setStore((currentStore) =>
      removeHabitFromHistory(
        {
          ...currentStore,
          habits: currentStore.habits.filter((habit) => habit.id !== habitId),
        },
        habitId,
      ),
    );
    if (editingId === habitId) cancelEditing();
  };

  return (
    <main className="habit-app min-h-screen bg-background text-foreground">
      <div className="hidden" />

      <div className="app-shell">
        <header className="app-header">
          <div className="brand-block flex items-center gap-3">
            <div className="brand-mark grid size-10 place-items-center bg-primary text-primary-foreground">
              <Leaf className="size-5" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[17px] font-semibold tracking-tight">好习惯</p>
              <p className="text-xs text-muted-foreground">
                一天一点，慢慢变好
              </p>
            </div>
          </div>
          <p className="date-label">{dateLabel}</p>
        </header>

        <div className="workspace">
          <section className="daily-overview">
            <p className="section-kicker text-sm font-medium text-primary">
              今天，也在认真生活
            </p>
            <h1 className="overview-title">
              把想坚持的小事，
              <span className="block">一件件完成。</span>
            </h1>
            <p className="overview-description">
              不用追求完美，只要今天比昨天多走一小步。
            </p>

            <Card className="daily-progress gap-0 py-0 ring-0">
              <CardContent className="p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">今日完成</p>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="progress-count">{completedCount}</span>
                      <span className="text-base text-muted-foreground">
                        / {store.habits.length} 项
                      </span>
                    </p>
                  </div>
                  <div
                    className={`stat-orb grid size-10 place-items-center rounded-full transition-colors duration-200 ${
                      allDone
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-primary'
                    }`}
                    aria-hidden="true"
                  >
                    <CheckCircle2 className="size-6" />
                  </div>
                </div>
                <Progress
                  value={completionPercent}
                  aria-label={`今日完成进度 ${completionPercent}%`}
                  className="mt-5 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-secondary"
                />
                <p
                  className="mt-4 text-sm leading-6 text-muted-foreground"
                  aria-live="polite"
                >
                  {allDone
                    ? '今天的习惯全部完成，真不错！'
                    : store.habits.length
                      ? `再完成 ${store.habits.length - completedCount} 项，就全部打卡啦`
                      : '添加第一个习惯，开启今天的进度'}
                </p>

                <div
                  className="history-summary"
                  aria-label={`当前连续完成 ${currentStreak} 天，最近 7 天有 ${completedDaysInRecentOverview} 天全部完成`}
                >
                  <div className="history-stat">
                    <TrendingUp className="size-4" aria-hidden="true" />
                    <span>当前连续</span>
                    <strong>{currentStreak}</strong>
                    <span>天</span>
                  </div>
                  <div className="history-stat">
                    <CalendarCheck2 className="size-4" aria-hidden="true" />
                    <span>近 7 天</span>
                    <strong>{completedDaysInRecentOverview}</strong>
                    <span>/ 7</span>
                  </div>
                </div>

                <ol className="history-strip" aria-label="最近 7 天完成概览">
                  {recentOverview.map((day) => {
                    const dayLabel = getHistoryDayLabel(day.dateKey, todayKey);
                    const statusLabel =
                      day.totalCount === 0
                        ? '无习惯'
                        : day.state === 'complete'
                          ? `完成 ${day.completedCount}/${day.totalCount}`
                          : day.state === 'partial'
                            ? `完成 ${day.completedCount}/${day.totalCount}`
                            : `未完成 0/${day.totalCount}`;

                    return (
                      <li key={day.dateKey} className="history-day">
                        <span className="history-day-label">{dayLabel}</span>
                        <span
                          className="history-day-dot"
                          data-state={day.state}
                          aria-hidden="true"
                          title={`${dayLabel}：${statusLabel}`}
                        />
                        <span className="sr-only">
                          {dayLabel}：{statusLabel}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="habit-list-title">
            <Card className="habit-panel gap-0 py-0 ring-0">
              <CardContent className="panel-content">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Today
                    </p>
                    <h2
                      id="habit-list-title"
                      className="mt-1 text-2xl font-semibold tracking-tight"
                    >
                      今日习惯
                    </h2>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {store.habits.length} 个习惯
                  </span>
                </div>

                <form
                  className="mt-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addHabit();
                  }}
                  noValidate
                >
                  <div className="add-row flex gap-2.5">
                    <Input
                      value={newHabitName}
                      onChange={(event) => {
                        setNewHabitName(event.target.value);
                        if (newHabitError) setNewHabitError('');
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          addHabit();
                        }
                      }}
                      maxLength={MAX_NAME_LENGTH + 1}
                      placeholder="例如：喝水、运动、读书"
                      aria-label="新的习惯名称"
                      aria-invalid={Boolean(newHabitError)}
                      aria-describedby={
                        newHabitError ? 'new-habit-error' : undefined
                      }
                      className="habit-input h-12 min-w-0 rounded-lg border-border bg-background px-3.5 text-base shadow-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/15"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="add-habit h-12 shrink-0 rounded-lg px-4 text-sm font-medium sm:px-5"
                    >
                      <Plus className="size-4.5" aria-hidden="true" />
                      <span className="hidden sm:inline">添加习惯</span>
                      <span className="sm:hidden">添加</span>
                    </Button>
                  </div>
                  {newHabitError && (
                    <p
                      id="new-habit-error"
                      className="mt-2 flex items-center gap-1.5 text-sm text-destructive"
                      role="alert"
                    >
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      {newHabitError}
                    </p>
                  )}
                </form>

                {storageWarning && (
                  <output
                    className="storage-warning mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900"
                    aria-live="polite"
                  >
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{storageWarning}</span>
                  </output>
                )}

                <div className="mt-6" aria-busy={!isHydrated}>
                  {store.habits.length === 0 ? (
                    <div className="empty-habits grid place-items-center px-6 text-center">
                      <div>
                        <div className="empty-symbol mx-auto grid size-14 place-items-center rounded-2xl text-primary">
                          <CheckCircle2 className="size-6" aria-hidden="true" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold">
                          还没有习惯
                        </h3>
                        <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                          从一件容易做到的小事开始，完成后就在这里打个勾。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ul className="habit-list" aria-label="今天的习惯">
                      {store.habits.map((habit) => {
                        const isCompleted = completedIds.has(habit.id);
                        const isEditing = editingId === habit.id;

                        return (
                          <li
                            key={habit.id}
                            data-completed={isCompleted}
                            className="habit-row group"
                          >
                            <div className="flex min-h-9 items-center gap-3.5">
                              <Checkbox
                                checked={isCompleted}
                                onCheckedChange={(checked) =>
                                  toggleHabit(habit.id, checked === true)
                                }
                                aria-label={`${isCompleted ? '取消完成' : '标记完成'}：${habit.name}`}
                                className="size-6 rounded-lg border-input data-checked:animate-[habit-pop_180ms_ease-out] [&_[data-slot=checkbox-indicator]>svg]:size-4"
                              />

                              {isEditing ? (
                                <div className="min-w-0 flex-1">
                                  <Input
                                    ref={editInputRef}
                                    value={editingName}
                                    onChange={(event) => {
                                      setEditingName(event.target.value);
                                      if (editingError) setEditingError('');
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        saveEditing();
                                      }
                                      if (event.key === 'Escape')
                                        cancelEditing();
                                    }}
                                    maxLength={MAX_NAME_LENGTH + 1}
                                    aria-label={`编辑习惯：${habit.name}`}
                                    aria-invalid={Boolean(editingError)}
                                    className="h-9 rounded-xl bg-card"
                                  />
                                  {editingError && (
                                    <p
                                      className="mt-1 text-xs text-destructive"
                                      role="alert"
                                    >
                                      {editingError}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className={`min-w-0 flex-1 truncate text-[15px] font-medium transition-all ${
                                    isCompleted
                                      ? 'text-muted-foreground line-through decoration-primary/45'
                                      : ''
                                  }`}
                                >
                                  {habit.name}
                                </span>
                              )}

                              <div className="flex shrink-0 items-center gap-0.5">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={saveEditing}
                                      aria-label={`保存习惯：${habit.name}`}
                                      className="rounded-xl text-primary hover:bg-primary/10 hover:text-primary"
                                    >
                                      <Check />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={cancelEditing}
                                      aria-label="取消编辑"
                                      className="rounded-xl text-muted-foreground"
                                    >
                                      <X />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => beginEditing(habit)}
                                      aria-label={`编辑习惯：${habit.name}`}
                                      className="rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    >
                                      <Pencil />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger
                                        render={
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`删除习惯：${habit.name}`}
                                            className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                          />
                                        }
                                      >
                                        <Trash2 />
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            删除“{habit.name}”？
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            删除后，这个习惯的历史完成记录也会一并移除。
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            取消
                                          </AlertDialogCancel>
                                          <AlertDialogCancel
                                            variant="destructive"
                                            onClick={() =>
                                              deleteHabit(habit.id)
                                            }
                                          >
                                            删除
                                          </AlertDialogCancel>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <p className="privacy-note">
              数据只保存在当前浏览器 · 每天自动记录历史
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
