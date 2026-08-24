/**
 * One way to hand the operator a file.
 *
 * There were three before this: the scanner built a Blob URL and never revoked
 * it, the simulator built one and did, and the AMR engine encoded the whole
 * report into a `data:` URI and appended a hidden anchor to the document. None
 * of them told the user anything had happened. This does all of it in one
 * place — revokes the URL, records the export in the activity log, and toasts
 * with the filename so there is visible confirmation the file was produced.
 */
import { toast } from "@/hooks/use-toast"

import { recordActivity, type EngineId } from "./activity-store"

interface DownloadOptions {
  /** Filename including extension. Sanitised before use. */
  filename: string
  /** Which engine produced it, so the export lands in the activity log. */
  engine?: EngineId
  /** Overrides the default "Exported <filename>" toast. */
  description?: string
  /** Skip the toast — for callers that show their own confirmation. */
  silent?: boolean
}

/**
 * Filenames are built from sequence headers and strain names, which routinely
 * contain characters that are illegal on Windows (`:`, `|`, `?`, `*`) or that
 * start a path segment. Anything outside a conservative set becomes `-`.
 */
export function safeFilename(name: string, fallback = "helixmind-export"): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120)
  return cleaned.length > 0 ? cleaned : fallback
}

/** A sortable `20260824-1432` stamp for filenames. */
export function fileStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

/** Save a Blob, revoking the object URL once the browser has taken it. */
export function downloadBlob(blob: Blob, options: DownloadOptions): void {
  const filename = safeFilename(options.filename)
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.rel = "noopener"
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // Revoking synchronously can cancel the download in some browsers, so this
    // waits a tick. Without a revoke at all the Blob is pinned for the lifetime
    // of the document, which is what the scanner was doing on every export.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  if (options.engine) {
    recordActivity({
      kind: "export.created",
      engine: options.engine,
      label: `Exported ${filename}`,
      detail: options.description,
      severity: "info",
    })
  }

  if (!options.silent) {
    toast({
      variant: "success",
      title: "Export ready",
      description: options.description ?? `Saved ${filename} to your downloads.`,
    })
  }
}

export function downloadJSON(data: unknown, options: DownloadOptions): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  downloadBlob(blob, options)
}

export function downloadText(
  text: string,
  options: DownloadOptions & { mimeType?: string },
): void {
  const blob = new Blob([text], {
    type: options.mimeType ?? "text/plain;charset=utf-8",
  })
  downloadBlob(blob, options)
}

/**
 * Rows to CSV, quoting anything that would otherwise break the row.
 *
 * The scanner and the growth lab both joined values with commas and no quoting,
 * so a mechanism like "Cell wall remodeling, high-level" silently split into
 * two columns.
 */
export function toCSV(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number) => {
    const text = String(value ?? "")
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\r\n")
}

export function downloadCSV(
  headers: string[],
  rows: Array<Array<string | number>>,
  options: DownloadOptions,
): void {
  // The BOM is what makes Excel open UTF-8 CSVs as UTF-8 rather than as the
  // system codepage, which otherwise mangles species names.
  downloadText("﻿" + toCSV(headers, rows), {
    ...options,
    mimeType: "text/csv;charset=utf-8",
  })
}

/**
 * Copy to the clipboard, reporting whether it worked.
 *
 * `navigator.clipboard` is undefined on insecure origins and rejects when the
 * document is not focused. The scanner called it unguarded and showed a success
 * tick either way, so a failed copy looked exactly like a successful one.
 */
export async function copyToClipboard(
  text: string,
  label = "Copied to clipboard",
): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard unavailable")
    await navigator.clipboard.writeText(text)
    toast({ variant: "success", title: label })
    return true
  } catch {
    toast({
      variant: "destructive",
      title: "Couldn't copy",
      description:
        "Your browser blocked clipboard access. Select the text and copy it manually.",
    })
    return false
  }
}
