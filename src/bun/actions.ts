import Electrobun, { BrowserView, Updater, WindowOptionsType } from "electrobun/bun";
import { RPCType } from "../common/types";
import { constants } from "./constants";
import { menu } from "./menu";
import { state } from "./state";
import { windows } from "./windows";

function closeWin(id: number) {
  const win = state.windowCollection[id];
  if (win) {
    win.close();
    delete state.windowCollection[id];
  }
  menu.set();
}

function launchWin(i: Partial<WindowOptionsType<any>>) {
  // if current window with same title exists, focus it instead of creating a new one
  if (windows.getWindowByTitle(i.title || "")) {
    const existingWin = Object.values(state.windowCollection).find((w) => w.title === i.title);
    if (existingWin) {
      existingWin.focus();
      return;
    }
  }

  const win = windows.launch(i);
  menu.addForm({ label: i.title, action: `${win.id}-${constants.WINDOW_ACTION.FOCUS}` });
  // add to state object
  state.windowCollection[win.id] = win;
  // update the menu
  menu.set();
  // on close remove from menu and state
  win.on("close", (event: any) => {
    const { id } = event.data;
    delete state.windowCollection[id];
    menu.removeForm(i.title || "");
  });
}

async function init() {
  let mainUrl = "views://main/index.html";

  // Check if we're in development mode and if the Vite dev server is running
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(constants.DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${constants.DEV_SERVER_URL}`);
      mainUrl = constants.DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }

  const println = (message: string) => {
    console.log(message);
  };

  const rpc = BrowserView.defineRPC<RPCType>({
    handlers: {
      requests: {
        println: println,
        launchWin: launchWin,
      },
      messages: {},
    },
  });

  // Launch the main application window
  windows.launch({
    title: "Clide",
    url: mainUrl,
    frame: {
      width: 500,
      height: 500,
      x: 100,
      y: 100,
    },
    rpc,
    transparent: false,
    styleMask: {
      Borderless: false,
      Titled: true,
      Closable: true,
      Miniaturizable: true,
      Resizable: true,
      UnifiedTitleAndToolbar: false,
      FullScreen: false,
      FullSizeContentView: false,
      UtilityWindow: false,
      DocModalWindow: false,
      NonactivatingPanel: false,
      HUDWindow: false,
    },
    titleBarStyle: "default",
  });

  // Set up the application menu
  menu.set();
}

Electrobun.events.on("application-menu-clicked", (e) => {
  console.log("application menu clicked", e.data.action); // custom-action
  const [id, action] = e.data.action.split("-");
  if (action === constants.WINDOW_ACTION.FOCUS && state.windowCollection[id]) {
    state.windowCollection[id].focus();
  }
});

export const actions = { launchWin, init, closeWin };
