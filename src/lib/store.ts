"use client";

import { useSyncExternalStore } from "react";
import { appNow } from "./actions";
import { emptyState, parseState, STORAGE_KEY, type AppState } from "./storage";

/** A tiny external store over localStorage: one key, parsed and validated once, shared by every page. */

let cached: AppState | null = null;
const listeners = new Set<() => void>();

function readStorage(): AppState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}

function snapshot(): AppState {
  cached ??= readStorage();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setState(next: AppState | ((current: AppState) => AppState)) {
  cached = typeof next === "function" ? next(snapshot()) : next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Private mode or full storage: keep working in memory for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** `null` while rendering on the server and during hydration, the stored state afterwards. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function useNow(state: AppState | null): Date {
  return appNow(state ?? emptyState());
}
