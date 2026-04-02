/**
 * Report Service — handles AI content report creation, persistence, and export.
 *
 * Reports are stored in localStorage under `easyeditor-ai-reports`.
 * In Tauri environments, reports are also persisted to a JSON file
 * in the app data directory (fire-and-forget).
 */

export interface ReportEntry {
  category: string;
  description: string;
  timestamp: string;       // ISO 8601 UTC
  aiAction: string | null;
  aiAgent: string | null;  // e.g. "Ollama", "Gemini", "Claude", "Bedrock"
  aiModel: string | null;  // e.g. "ministral-3:3b", "gemini-2.0-flash"
  userPrompt: string | null;   // the prompt the user sent
  aiResponse: string | null;   // the content the AI generated
}

export const REPORT_CATEGORIES = [
  'offensive',
  'inaccurate',
  'harmful',
  'explicit',
  'spam',
  'other',
] as const;

export type ReportCategory = typeof REPORT_CATEGORIES[number];

const STORAGE_KEY = 'easyeditor-ai-reports';
const MAX_ENTRIES = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_RESPONSE_LENGTH = 5000;
const REPORT_FILENAME = 'ai-content-reports.json';

/**
 * Returns `true` if running inside a Tauri desktop environment.
 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Read all reports from localStorage. Returns `[]` on parse failure and resets the key.
 */
export function getReports(): ReportEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEY, '[]');
      return [];
    }
    return parsed as ReportEntry[];
  } catch {
    localStorage.setItem(STORAGE_KEY, '[]');
    return [];
  }
}

/**
 * Submit a report entry. Validates category, truncates description,
 * enforces 100-entry FIFO cap, and writes to localStorage.
 * In Tauri environments, also persists to file (fire-and-forget).
 * Returns `true` on success, `false` on failure.
 */
export function submitReport(entry: ReportEntry): boolean {
  try {
    // Validate category
    if (!(REPORT_CATEGORIES as readonly string[]).includes(entry.category)) {
      return false;
    }

    // Truncate description to 500 chars, aiResponse to 5000 chars
    const sanitizedEntry: ReportEntry = {
      ...entry,
      description: entry.description.slice(0, MAX_DESCRIPTION_LENGTH),
      aiResponse: entry.aiResponse ? entry.aiResponse.slice(0, MAX_RESPONSE_LENGTH) : null,
    };

    const reports = getReports();
    reports.push(sanitizedEntry);

    // Enforce FIFO cap
    while (reports.length > MAX_ENTRIES) {
      reports.shift();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));

    // Tauri file persistence (fire-and-forget)
    if (isTauriEnv()) {
      persistToFile(reports).catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Persist reports to a JSON file in the Tauri app data directory.
 * Dynamically imports Tauri APIs. Returns `true` on success, `false` on failure.
 */
export async function persistToFile(reports: ReportEntry[]): Promise<boolean> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { appDataDir } = await import('@tauri-apps/api/path');

    const dir = await appDataDir();
    const filePath = `${dir}${REPORT_FILENAME}`;

    // Enforce FIFO cap on file contents as well
    const capped = reports.length > MAX_ENTRIES
      ? reports.slice(reports.length - MAX_ENTRIES)
      : reports;

    await writeTextFile(filePath, JSON.stringify(capped, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Export reports as a downloadable JSON file (web browser).
 * No-op if the report array is empty.
 */
export function downloadReportsAsFile(): void {
  const reports = getReports();
  if (reports.length === 0) return;

  const json = JSON.stringify(reports, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = REPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
