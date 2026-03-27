/**
 * CacheStore — in-memory store for per-file AI summary records
 * accumulated during repository scanning.
 *
 * Backed by a Map keyed on filePath; duplicate additions overwrite
 * the previous record for that path.
 */

/** A single cached summary produced by the per-file AI analysis. */
export interface SummaryRecord {
  /** Relative path from repo root, or `"__directory_tree__"` for the tree entry. */
  filePath: string;
  /** Detected language or file extension, e.g. `"typescript"`, `"json"`. */
  fileType: string;
  /** AI-generated summary text. */
  summary: string;
}

export class CacheStore {
  private readonly records = new Map<string, SummaryRecord>();

  /** Add (or overwrite) a summary record keyed by its `filePath`. */
  add(record: SummaryRecord): void {
    this.records.set(record.filePath, record);
  }

  /** Return all stored records in insertion order. */
  getAll(): SummaryRecord[] {
    return Array.from(this.records.values());
  }

  /** Retrieve a single record by its file path, or `undefined` if absent. */
  getByPath(filePath: string): SummaryRecord | undefined {
    return this.records.get(filePath);
  }

  /** Remove all records from the store. */
  clear(): void {
    this.records.clear();
  }

  /** Number of records currently stored. */
  get size(): number {
    return this.records.size;
  }
}
