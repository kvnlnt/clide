import type { RpcInvokeRequest, RpcInvokeResponse } from "../../shared/rpc";
import { hello } from "./hello";

type Handler = (request: RpcInvokeRequest) => RpcInvokeResponse | Promise<RpcInvokeResponse>;

const routes: Record<string, Handler> = {
  hello,
};

export function dispatch(request: RpcInvokeRequest): RpcInvokeResponse | Promise<RpcInvokeResponse> {
  const handler = routes[request.method];
  if (!handler) {
    return { ok: false, error: `No handler for method: ${request.method}` };
  }
  return handler(request);
}
