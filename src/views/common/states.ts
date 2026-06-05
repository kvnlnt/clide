import { State } from "@linttrap/oem";
import { ScriptType } from "../../common/types";

const appState = State<"LIST">("LIST");
const devModeState = State(false);
const scriptFilterState = State("");
const folderListState = State<string[]>([
  "~/LintTrap/clide-test-cases/one",
  "~/LintTrap/clide-test-cases/two",
  "~/LintTrap/clide-test-cases/three",
]);

const example: ScriptType = {
  name: "hello-world",
  icon: "🌍",
  description: "A simple script that prints a greeting message.",
  script: "echo Hello, World!",
  dependencies: {
    echo: {
      version: "1.0.0",
      description: "A command-line utility that outputs the given arguments to the console.",
      install: "echo is a built-in command in most shells, so no installation is required.",
    },
  },
  form: {
    greet: {
      type: "string",
      label: "Greeting",
      description: "The greeting message to display.",
      default: "",
      placeholder: "Enter your greeting message here",
      validation: {
        required: true,
        minLength: 1,
        maxLength: 100,
      },
    },
  },
};

const scriptCollection = State<ScriptType[]>([
  example,
  Object.assign({}, example, {
    name: "goodbye-world",
    description: "A simple script that prints a farewell message.",
    script: "echo Goodbye, World!",
  }),
  Object.assign({}, example, {
    name: "greet-user",
    description: "A script that greets the user with a custom message.",
    script: "echo ${greet}",
  }),
  Object.assign({}, example, {
    name: "repeat-greeting",
    description: "A script that repeats the greeting message a specified number of times.",
    script: "for i in {1..${count}}; do echo ${greet}; done",
  }),
  Object.assign({}, example, {
    name: "current-date",
    description: "A script that displays the current date and time.",
    script: "date",
  }),
  Object.assign({}, example, {
    name: "list-files",
    description: "A script that lists all files in the current directory.",
    script: "ls -la",
  }),
  Object.assign({}, example, {
    name: "disk-usage",
    description: "A script that shows the disk usage of the current directory.",
    script: "du -h .",
  }),
  Object.assign({}, example, {
    name: "system-info",
    description: "A script that displays basic system information.",
    script: "uname -a",
  }),
  Object.assign({}, example, {
    name: "network-info",
    description: "A script that shows the current network configuration.",
    script: "ifconfig",
  }),
  Object.assign({}, example, {
    name: "process-list",
    description: "A script that lists all running processes.",
    script: "ps aux",
  }),
]);

export const state = {
  appState,
  devModeState,
  folderListState,
  scriptCollection,
  scriptFilterState,
};
