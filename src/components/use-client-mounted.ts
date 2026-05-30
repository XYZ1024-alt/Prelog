"use client";

import { useSyncExternalStore } from "react";

export function useClientMounted() {
  return useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerSnapshot);
}

function subscribeMounted() {
  return () => undefined;
}

function getMountedSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}
