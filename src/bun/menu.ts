import { ApplicationMenu, ApplicationMenuItemConfig } from "electrobun/bun";

let config: Array<ApplicationMenuItemConfig> = [
  {
    submenu: [{ label: "Quit", role: "quit" }],
  },
  // {
  //   label: "Edit",
  //   submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }],
  // },
];

function addForm(item: ApplicationMenuItemConfig) {
  // get the "Scripts" submenu, or create it if it doesn't exist
  let formsMenu = config.find((menu) => "label" in menu && menu.label === "Scripts");
  if (!formsMenu) {
    formsMenu = { label: "Scripts", submenu: [] };
    config.push(formsMenu);
  }
  // add the new form to the submenu
  if ("submenu" in formsMenu && formsMenu.submenu) {
    formsMenu.submenu.push(item);
  }
}

function removeForm(label: string) {
  const formsMenuIndex = config.findIndex((menu) => "label" in menu && menu.label === "Scripts");
  const formsMenu = formsMenuIndex >= 0 ? config[formsMenuIndex] : undefined;

  if (formsMenu && "submenu" in formsMenu && formsMenu.submenu) {
    formsMenu.submenu = formsMenu.submenu.filter((item) => "label" in item && item.label !== label);

    if (formsMenu.submenu.length === 0) {
      config.splice(formsMenuIndex, 1);
    }
  }

  ApplicationMenu.setApplicationMenu(config);
}

function set(newConfig: Array<ApplicationMenuItemConfig> = config) {
  ApplicationMenu.setApplicationMenu(newConfig);
  config = newConfig;
}

export const menu = { set, addForm, removeForm };
