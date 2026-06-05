import { BrowserWindow } from "electrobun/bun";

const windowCollection: { [key: number]: BrowserWindow } = {};

export const state = {
  windowCollection,
};
