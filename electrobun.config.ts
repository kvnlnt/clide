import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "vanilla-vite",
    identifier: "vanillavite.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    copy: {
      "dist/index.html": "views/main/index.html",
      "dist/assets": "views/main/assets",
    },
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
