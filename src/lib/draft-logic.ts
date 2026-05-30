export type DraftState = {
  readonly savedAt: number;
  readonly value: string;
};

export function getDraftLoadState(options: {
  readonly baselineTimestamp?: number;
  readonly draft: DraftState | null;
  readonly initialValue: string;
}) {
  const { baselineTimestamp, draft, initialValue } = options;

  if (!draft?.value) {
    return "empty" as const;
  }

  if (baselineTimestamp && draft.savedAt <= baselineTimestamp && draft.value !== initialValue) {
    return "stale" as const;
  }

  if (draft.value !== initialValue) {
    return "available" as const;
  }

  return "synced" as const;
}

export function getDraftSaveState(options: {
  readonly initialValue: string;
  readonly restoredValue: string | null;
  readonly value: string;
}) {
  const { initialValue, restoredValue, value } = options;

  if (value === initialValue) {
    return "synced" as const;
  }

  if (restoredValue === value) {
    return "restored" as const;
  }

  return "dirty" as const;
}
