/**
 * Google Drive provider stub (ticket 102): interface implementation that returns
 * "not connected" for all methods. Full OAuth + API integration is a future ticket.
 */

import type {
  VfsCapabilities,
  VfsListResult,
  VfsOpenResult,
  VfsProvider,
  VfsReadResult,
  VfsSearchResult,
  VfsStatResult,
} from "./provider";

const NOT_CONNECTED = "Google Drive not connected";

export class GDriveProvider implements VfsProvider {
  readonly id = "gdrive";
  readonly capabilities: VfsCapabilities = {
    watchable: false,
    writable: false,
    previewUrl: true,
  };

  async list(_uri: string): Promise<VfsListResult> {
    return { entries: [], error: NOT_CONNECTED };
  }

  async stat(_uri: string): Promise<VfsStatResult | null> {
    return null;
  }

  async read(_uri: string, _maxBytes?: number): Promise<VfsReadResult> {
    return {
      data: new Uint8Array(),
      mime: "",
      error: NOT_CONNECTED,
    };
  }

  async search(_rootUri: string, _query: string): Promise<VfsSearchResult> {
    return { paths: [], error: NOT_CONNECTED };
  }

  async openNative(_uri: string, _reveal?: boolean): Promise<VfsOpenResult> {
    return { ok: false, error: NOT_CONNECTED };
  }
}
