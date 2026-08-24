/**
 * The last real result from each engine, kept so the Overview can show it.
 *
 * The Overview's three panes — the sequence viewer, the mutation log and the
 * resistance chart — were each built on a literal: a repeating
 * `ATGCTAGCTAGC…` strand with an invented "hotspot 15–25", five made-up
 * variants, and six invented resistance percentages. None of them changed when
 * you ran anything, which is what made the Overview decorative rather than a
 * summary.
 *
 * Analyses write a small snapshot here when they finish, and the Overview reads
 * it back. Only a preview is kept: a whole genome does not belong in
 * `localStorage`, and the Overview only ever renders the first screenful.
 */
import * as React from "react"

import { STORAGE_KEYS, readJSON, writeJSON, removeKey } from "./storage"

/** Bases kept for the Overview's sequence viewer. */
export const PREVIEW_BASES = 900

/** Variants kept for the Overview's mutation log. */
export const PREVIEW_MUTATIONS = 25

export interface ScanSnapshot {
  savedAt: number
  header: string
  referenceHeader?: string
  /** Full length of the scanned sequence, not the preview's length. */
  length: number
  gcContent: number
  /** The first {@link PREVIEW_BASES} bases. */
  preview: string
  /** Total variants called, which may exceed the sample below. */
  mutationCount: number
  /** 1-based positions, capped at {@link PREVIEW_MUTATIONS}. */
  mutations: Array<{
    position: number
    refBase: string
    varBase: string
    substitution: "transition" | "transversion"
  }>
}

export interface PredictionSnapshot {
  savedAt: number
  organism: string
  calls: Array<{
    drugClass: string
    /** 0–1. */
    score: number
    genes: string[]
    isSynergistic: boolean
  }>
}

export interface LabSnapshot {
  scan?: ScanSnapshot
  prediction?: PredictionSnapshot
}

const EMPTY: LabSnapshot = {}

let snapshot: LabSnapshot = EMPTY
let hydrated = false
const listeners = new Set<() => void>()

function hydrate() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  snapshot = readJSON<LabSnapshot>(STORAGE_KEYS.snapshot, EMPTY) ?? EMPTY
}

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: LabSnapshot) {
  snapshot = next
  writeJSON(STORAGE_KEYS.snapshot, next)
  emit()
}

export function saveScanSnapshot(scan: Omit<ScanSnapshot, "savedAt">) {
  hydrate()
  commit({
    ...snapshot,
    scan: {
      ...scan,
      savedAt: Date.now(),
      preview: scan.preview.slice(0, PREVIEW_BASES),
      mutations: scan.mutations.slice(0, PREVIEW_MUTATIONS),
    },
  })
}

export function savePredictionSnapshot(
  prediction: Omit<PredictionSnapshot, "savedAt">,
) {
  hydrate()
  commit({ ...snapshot, prediction: { ...prediction, savedAt: Date.now() } })
}

export function clearSnapshot() {
  snapshot = EMPTY
  removeKey(STORAGE_KEYS.snapshot)
  emit()
}

function subscribe(listener: () => void) {
  hydrate()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  hydrate()
  return snapshot
}

function getServerSnapshot() {
  return EMPTY
}

export function useLabSnapshot(): LabSnapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
