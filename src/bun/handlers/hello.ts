import type { RpcInvokeRequest, RpcInvokeResponse } from "../../shared/rpc";

export function hello(_request: RpcInvokeRequest): RpcInvokeResponse {
  return {
    ok: true,
    target: "#rpc-output",
    html: `<cl-hello name="Electrobun"></cl-hello>`,
  };
}
