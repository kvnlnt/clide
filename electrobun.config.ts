import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "CLIDE",
    identifier: "media.linttrap.clide",
    version: "0.0.1",
  },
  build: {
    // Vite builds to dist/, we copy from there. Ticket 138: the companion
    // window's html lands under the same "mainview" views host (renamed to
    // companion.html) so it shares the one copied assets/ folder instead of
    // needing its own duplicate copy.
    copy: {
      "dist/mainview/index.html": "views/mainview/index.html",
      "dist/companion/index.html": "views/mainview/companion.html",
      "dist/assets": "views/mainview/assets",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
