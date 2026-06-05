import { actions } from "./actions";

// Set up the application menu
try {
  await actions.init();
} catch (error) {
  console.error("Failed to initialize Electrobun app", error);
}
