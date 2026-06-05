import { BrowserWindow, WindowOptionsType } from "electrobun/bun";
import { state } from "./state";

function launch({
  title = "New Window",
  url,
  frame: { width, height, x, y } = { width: 800, height: 600, x: 100, y: 100 },
  ...rest
}: Partial<WindowOptionsType<any>>) {
  // check if a window with the same title already exists, focus it instead of creating a new one
  const existingWin = Object.values(state.windowCollection).find((win) => win.title === title);
  if (existingWin) {
    existingWin.focus();
    return existingWin;
  }

  const win = new BrowserWindow({
    ...rest,
    title,
    frame: { width, height, x, y },
    url,
  });
  state.windowCollection[win.id] = win;
  return win;
}

function getWindowById(id: number) {
  return Object.values(state.windowCollection).find((win) => win.id === id);
}

function getWindowByTitle(title: string) {
  return Object.values(state.windowCollection).find((win) => win.title === title);
}

export const windows = { launch, getWindowById, getWindowByTitle };
