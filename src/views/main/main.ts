import { Electroview } from "electrobun/view";
import type { AppRPCSchema, RpcInvokeResponse } from "../../shared/rpc";
import "./components/cl-hello";

const rpc = Electroview.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {},
    messages: {},
  },
});

new Electroview({ rpc });

function handleResponse(response: RpcInvokeResponse) {
  if (!response.ok) {
    console.error("RPC error:", response.error);
    return;
  }
  if (response.html && response.target) {
    const el = document.querySelector(response.target);
    if (el) el.innerHTML = response.html;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest("[data-rpc]") as HTMLElement | null;
    if (!btn) return;
    const method = (btn as HTMLElement & { dataset: DOMStringMap }).dataset.rpc!;
    const response = await rpc.request.rpc({ method });
    handleResponse(response);
  });
});
