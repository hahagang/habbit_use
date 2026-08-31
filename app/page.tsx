'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Leaf,
  Pencil,
  Plus,
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

type Habit = {
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

const STORAGE_KEY = 'good-habits:v1';
const MAX_NAME_LENGTH = 30;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyStore(): HabitStoreV1 {
  return {
    version: 1,
    habits: [],
    completionDate: getLocalDateKey(),
    completedHabitIds: [],
  };
}

function isValidStore(value: unknown): value is HabitStoreV1 {
  if (!value || typeof value !== 'object') return false;

  const store = value as Partial<HabitStoreV1>;
  return (
    store.version === 1 &&
    typeof store.completionDate === 'string' &&
    Array.isArray(store.habits) &&
    store.habits.every(
      (habit) =>
        habit &&
        typeof habit.id === 'string' &&
        typeof habit.name === 'string' &&
        typeof habit.createdAt === 'string',
    ) &&
    Array.isArray(store.completedHabitIds) &&
    store.completedHabitIds.every((id) => typeof id === 'string')
  );
}

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

export default function Home() {
  const [store, setStore] = useState<HabitStoreV1>(createEmptyStore);
  const [isHydrated, setIsHydrated] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitError, setNewHabitError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingError, setEditingError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const refreshForToday = useCallback(() => {
    const today = getLocalDateKey();
    setStore((currentStore) =>
      currentStore.completionDate === today
        ? currentStore
        : {
            ...currentStore,
            completionDate: today,
            completedHabitIds: [],
          },
    );
  }, []);

  useEffect(() => {
    const today = getLocalDateKey();

    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!savedValue) {
        setStore(createEmptyStore());
      } else {
        const parsedValue: unknown = JSON.parse(savedValue);
        if (!isValidStore(parsedValue)) throw new Error('Invalid habit store');

        const validHabitIds = new Set(parsedValue.habits.map((habit) => habit.id));
        setStore({
          ...parsedValue,
          completionDate: today,
          completedHabitIds:
            parsedValue.completionDate === today
              ? parsedValue.completedHabitIds.filter((id) => validHabitIds.has(id))
              : [],
        });
      }
    } catch {
      setStore(createEmptyStore());
      setStorageWarning('本地数据无法读取，已为你开启一个新的列表。');
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      setStorageWarning('当前更改暂时只能保留在本页，刷新后可能会丢失。');
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

  const completedIds = useMemo(
    () => new Set(store.completedHabitIds),
    [store.completedHabitIds],
  );
  const completedCount = store.habits.reduce(
    (count, habit) => count + (completedIds.has(habit.id) ? 1 : 0),
    0,
  );
  const completionPercent = store.habits.length
    ? Math.round((completedCount / store.habits.length) * 100)
    : 0;
  const allDone = store.habits.length > 0 && completedCount === store.habits.length;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  const addHabit = () => {
    refreshForToday();
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
    refreshForToday();
    setStore((currentStore) => {
      const nextCompletedIds = new Set(currentStore.completedHabitIds);
      if (checked) nextCompletedIds.add(habitId);
      else nextCompletedIds.delete(habitId);

      return {
        ...currentStore,
        completedHabitIds: [...nextCompletedIds],
      };
    });
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
    setStore((currentStore) => ({
      ...currentStore,
      habits: currentStore.habits.filter((habit) => habit.id !== habitId),
      completedHabitIds: currentStore.completedHabitIds.filter(
        (completedId) => completedId !== habitId,
      ),
    }));
    if (editingId === habitId) cancelEditing();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[430px] bg-[radial-gradient(circle_at_15%_0%,oklch(0.91_0.06_145/0.68),transparent_38%),radial-gradient(circle_at_88%_8%,oklch(0.95_0.045_85/0.82),transparent_38%)]" />

      <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-7 sm:px-8 sm:pt-10 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.48_0.12_150/0.20)]">
              <Leaf className="size-5" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[17px] font-semibold tracking-tight">好习惯</p>
              <p className="text-xs text-muted-foreground">一天一点，慢慢变好</p>
            </div>
          </div>
          <p className="rounded-full border border-white/80 bg-white/50 px-3.5 py-2 text-sm font-medium text-foreground/70 shadow-sm backdrop-blur-sm">
            {dateLabel}
          </p>
        </header>

        <div className="mt-12 grid items-start gap-7 lg:mt-20 lg:grid-cols-[0.78fr_1.35fr] lg:gap-12">
          <section className="lg:sticky lg:top-10">
            <p className="text-sm font-medium text-primary">今天，也在认真生活</p>
            <h1 className="mt-3 max-w-md text-4xl font-semibold leading-[1.12] tracking-[-0.04em] sm:text-5xl">
              把想坚持的小事，
              <span className="text-primary">一件件完成。</span>
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-muted-foreground">
              不用追求完美，只要今天比昨天多走一小步。
            </p>

            <Card className="mt-8 gap-0 rounded-[28px] border-0 bg-[oklch(0.36_0.075_150)] py-0 text-white shadow-[0_24px_60px_oklch(0.30_0.06_150/0.18)] ring-0">
              <CardContent className="px-6 py-6 sm:px-7 sm:py-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/65">今日完成</p>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="text-5xl font-semibold tabular-nums tracking-tight">
                        {completedCount}
                      </span>
                      <span className="text-base text-white/60">/ {store.habits.length} 项</span>
                    </p>
                  </div>
                  <div
                    className={`grid size-12 place-items-center rounded-full transition-all duration-300 ${
                      allDone ? 'scale-100 bg-white text-primary' : 'bg-white/10 text-white/65'
                    }`}
                    aria-hidden="true"
                  >
                    <CheckCircle2 className="size-6" />
                  </div>
                </div>
                <Progress
                  value={completionPercent}
                  aria-label={`今日完成进度 ${completionPercent}%`}
                  className="mt-6 [&_[data-slot=progress-indicator]]:bg-white [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-white/15"
                />
                <p className="mt-3 text-xs text-white/60" aria-live="polite">
                  {allDone
                    ? '今天的习惯全部完成，真不错！'
                    : store.habits.length
                      ? `再完成 ${store.habits.length - completedCount} 项，就全部打卡啦`
                      : '添加第一个习惯，开启今天的进度'}
                </p>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="habit-list-title">
            <Card className="gap-0 overflow-visible rounded-[30px] border border-white/90 bg-card/92 py-0 shadow-[0_24px_70px_oklch(0.33_0.04_120/0.09)] ring-0 backdrop-blur-sm">
              <CardContent className="px-5 py-6 sm:px-7 sm:py-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Today
                    </p>
                    <h2 id="habit-list-title" className="mt-1 text-2xl font-semibold tracking-tight">
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
                  <div className="flex gap-2.5">
                    <Input
                      value={newHabitName}
                      onChange={(event) => {
                        setNewHabitName(event.target.value);
                        if (newHabitError) setNewHabitError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          addHabit();
                        }
                      }}
                      maxLength={MAX_NAME_LENGTH + 1}
                      placeholder="例如：喝水、运动、读书"
                      aria-label="新的习惯名称"
                      aria-invalid={Boolean(newHabitError)}
                      aria-describedby={newHabitError ? 'new-habit-error' : undefined}
                      className="h-12 rounded-2xl border-border/80 bg-white/70 px-4 text-base shadow-inner shadow-black/[0.015] placeholder:text-muted-foreground/65 focus-visible:border-primary focus-visible:ring-primary/15"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 rounded-2xl px-4 shadow-[0_8px_22px_oklch(0.50_0.13_150/0.18)] sm:px-5"
                    >
                      <Plus className="size-4.5" aria-hidden="true" />
                      <span className="hidden sm:inline">添加习惯</span>
                      <span className="sm:hidden">添加</span>
                    </Button>
                  </div>
                  {newHabitError && (
                    <p id="new-habit-error" className="mt-2 flex items-center gap-1.5 text-sm text-destructive" role="alert">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      {newHabitError}
                    </p>
                  )}
                </form>

                {storageWarning && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900" role="status">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{storageWarning}</span>
                  </div>
                )}

                <div className="mt-6" aria-busy={!isHydrated}>
                  {store.habits.length === 0 ? (
                    <div className="grid min-h-64 place-items-center rounded-[24px] border border-dashed border-border bg-secondary/35 px-6 py-10 text-center">
                      <div>
                        <div className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary">
                          <CheckCircle2 className="size-6" aria-hidden="true" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold">还没有习惯</h3>
                        <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                          从一件容易做到的小事开始，完成后就在这里打个勾。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-3" aria-label="今天的习惯">
                      {store.habits.map((habit) => {
                        const isCompleted = completedIds.has(habit.id);
                        const isEditing = editingId === habit.id;

                        return (
                          <li
                            key={habit.id}
                            data-completed={isCompleted}
                            className="habit-row group rounded-[22px] border border-border/70 bg-white/70 px-4 py-3.5 transition-all duration-200 hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_28px_oklch(0.35_0.04_130/0.07)] data-[completed=true]:border-primary/15 data-[completed=true]:bg-primary/[0.055]"
                          >
                            <div className="flex min-h-9 items-center gap-3.5">
                              <Checkbox
                                checked={isCompleted}
                                onCheckedChange={(checked) => toggleHabit(habit.id, checked === true)}
                                aria-label={`${isCompleted ? '取消完成' : '标记完成'}：${habit.name}`}
                                className="size-5 rounded-md border-primary/35 data-checked:animate-[habit-pop_180ms_ease-out] [&_[data-slot=checkbox-indicator]>svg]:size-4"
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
                                      if (event.key === 'Escape') cancelEditing();
                                    }}
                                    maxLength={MAX_NAME_LENGTH + 1}
                                    aria-label={`编辑习惯：${habit.name}`}
                                    aria-invalid={Boolean(editingError)}
                                    className="h-9 rounded-xl bg-white"
                                  />
                                  {editingError && (
                                    <p className="mt-1 text-xs text-destructive" role="alert">
                                      {editingError}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className={`min-w-0 flex-1 truncate text-[15px] font-medium transition-all ${
                                    isCompleted ? 'text-muted-foreground line-through decoration-primary/45' : ''
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
                                      className="rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
                                            className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                          />
                                        }
                                      >
                                        <Trash2 />
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>删除“{habit.name}”？</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            删除后，这个习惯今天的完成状态也会一并移除。
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>取消</AlertDialogCancel>
                                          <AlertDialogCancel
                                            variant="destructive"
                                            onClick={() => deleteHabit(habit.id)}
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

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground/75">
              数据只保存在当前浏览器 · 每天自动开始新一轮
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
