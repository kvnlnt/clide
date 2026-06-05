import { devModeState } from "../common/states";
import { tag, trait } from "../common/templates";
import { theme } from "../common/theme";

export function renderUI(root: HTMLElement) {
  root.append(
    tag.div(
      trait.style("display", "flex"),
      trait.style("justifyContent", "center"),
      trait.style("alignItems", "center"),
      trait.style("flexDirection", "column"),
      trait.style("gap", theme.box.space.lg),
      trait.style("height", "100vh"),
      trait.style("backgroundColor", theme.box.bg),
      trait.style("color", theme.text.primary),
      trait.style("border", `1px solid red`, devModeState.$test(true)),
      trait.style("padding", theme.box.space.lg),

      tag.div(
        trait.style("letterSpacing", "0.1em"),
        trait.style("fontWeight", "bold"),
        trait.style("backgroundColor", "rgba(0, 0, 0, 0.3)"),
        trait.style("padding", theme.box.space.md),
        trait.style("borderRadius", theme.box.radius.sm),
        trait.text("CLIDE"),
        trait.style("border", `1px solid red`, devModeState.$test(true)),
      ),
    ),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (root) {
    renderUI(root);
    console.log(renderUI.toString());
  }
});
