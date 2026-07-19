/**
 * VFS provider interface (ticket 102): unified abstraction over local disk,
 * Dropbox, Google Drive, and future remote/cloud providers.
 */

export interface VfsCapabilities {
  /** Can watch for changes via fs.watch or a provider-specific API. */
  watchable: boolean;
  /** Supports write operations (future — all providers are read-only in this epic). */
  writable: boolean;
  /** Can generate a direct preview URL (e.g. Dropbox shared link). */
  previewUrl: boolean;
}

export interface VfsStatResult {
  name: string;
  size: number;
  /** ISO timestamp of last modification. */
  mtime: string;
  isDirectory: boolean;
}

export interface VfsListResult {
  entries: VfsStatResult[];
  error?: string;
}

export interface VfsReadResult {
  /** Raw bytes of the file. */
  data: Uint8Array;
  /** MIME type inferred from extension or content. */
  mime: string;
  error?: string;
}

export interface VfsSearchResult {
  /** Matching file paths relative to the search root. */
  paths: string[];
  truncated?: boolean;
  error?: string;
}

export interface VfsOpenResult {
  ok: boolean;
  error?: string;
}

/**
 * A VFS provider implements reading, listing, searching, and opening files
 * from a specific storage backend. URIs are provider-scoped, e.g.
 * "local:/Users/...", "dropbox:/reports/q3.pdf".
 */
export interface VfsProvider {
  readonly id: string;
  readonly capabilities: VfsCapabilities;

  /**
   * List directory contents at a URI. Returns entries with stat metadata.
   * Non-recursive — use search for deep traversal.
   */
  list(uri: string): Promise<VfsListResult>;

  /**
   * Stat a single file or directory at a URI.
   */
  stat(uri: string): Promise<VfsStatResult | null>;

  /**
   * Read file contents. If maxBytes is set, stops reading after that limit.
   * Provider may refuse reads over a hardcoded cap (e.g. 25MB).
   */
  read(uri: string, maxBytes?: number): Promise<VfsReadResult>;

  /**
   * Search for files matching a query within a root URI. Query syntax is
   * provider-specific but should support at least substring + simple globs.
   * Results are bounded by depth and count caps.
   */
  search(rootUri: string, query: string): Promise<VfsSearchResult>;

  /**
   * Open a file with the system default app (reveal = open folder + select file).
   */
  openNative(uri: string, reveal?: boolean): Promise<VfsOpenResult>;

  /**
   * Watch a root URI for changes. Calls the callback with relative paths that
   * changed. Optional; only for providers where capabilities.watchable = true.
   */
  watch?(rootUri: string, callback: (paths: string[]) => void): () => void;
}
