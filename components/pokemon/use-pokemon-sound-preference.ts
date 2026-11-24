"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "renqd:pokemon:name-em-all:sound";
const CHANGE_EVENT = "renqd:pokemon:sound-preference-change";
let fallbackEnabled = true;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? fallbackEnabled : stored !== "false";
  } catch {
    return fallbackEnabled;
  }
}

function getServerSnapshot() {
  return true;
}

export function usePokemonSoundPreference() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setEnabled = useCallback((next: boolean) => {
    fallbackEnabled = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // The setting remains available in the current UI when storage is unavailable.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { enabled, setEnabled };
}
