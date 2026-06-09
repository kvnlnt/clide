import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type { AppRPCSchema, RpcInvokeRequest } from "../shared/rpc";
import { dispatch } from "./handlers";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://main/index.html";
}

const url = await getMainViewUrl();

const rpc = BrowserView.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {
      rpc(request: RpcInvokeRequest) {
        return dispatch(request);
      },
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: "Electrobun",
  url,
  rpc,
  frame: {
    width: 900,
    height: 700,
    x: 200,
    y: 200,
  },
});

console.log("Electrobun app started!", mainWindow.id);
