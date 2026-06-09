import type { RPCSchema } from "electrobun";

export type RpcInvokeRequest = {
  method: string;
  args?: unknown;
};

export type RpcInvokeResponse = {
  ok: boolean;
  data?: unknown;
  html?: string; // HTML fragment to inject
  target?: string; // CSS selector of the element whose innerHTML to replace
  error?: string;
};

export type AppRPCSchema = {
  bun: RPCSchema<{
    requests: {
      rpc: {
        params: RpcInvokeRequest;
        response: RpcInvokeResponse;
      };
    };
  }>;
  webview: RPCSchema;
};
