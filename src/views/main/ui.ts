import { actions } from "../common/actions";
import { state } from "../common/states";
import { tag, trait } from "../common/templates";
import { theme } from "../common/theme";

export function UI() {
  return tag.div(
    trait.style("display", "flex"),
    trait.style("justifyContent", "center"),
    trait.style("alignItems", "center"),
    trait.style("flexDirection", "column"),
    trait.style("height", "100vh"),
    trait.style("maxHeight", "100vh"),
    trait.style("overflow", "hidden"),
    trait.style("backgroundColor", theme.box.bg),
    trait.style("color", theme.text.primary),
    trait.style("border", `1px solid red`, state.devModeState.$test(true)),
    // header
    tag.div(
      trait.style("display", "flex"),
      trait.style("flexDirection", "row"),
      trait.style("flexWrap", "wrap"),
      trait.style("alignItems", "center"),
      trait.style("backgroundColor", theme.page.header.bg),
      trait.style("color", theme.page.header.text),
      trait.style("width", "100%"),
      trait.style("padding", theme.box.space.md),
      trait.style("height", "fit-content"),
      trait.style("border", `1px solid red`, state.devModeState.$test(true)),
      trait.style("listStyle", "none"),
      trait.style("margin", "0"),
      trait.style("gap", theme.box.space.md),
      trait.html(
        () => [
          ...state.folderListState
            .val()
            .map((f) =>
              tag.button(
                trait.style("backgroundColor", theme.button.bg),
                trait.style("border", `1px solid ${theme.button.text}`),
                trait.style("color", theme.button.text),
                trait.style("fontSize", theme.button.fontSize.sm),
                trait.style("padding", theme.box.space.sm),
                trait.style("borderRadius", theme.box.radius.sm),
                trait.style("cursor", "pointer"),
                trait.text(f),
              ),
            ),
          tag.input(
            trait.attr("type", "file"),
            trait.attr("webkitdirectory", "true"),
            trait.evt("change", (e: any) => {
              // actions.println("Selected folders:");
              // const files = event.target.files;
              // actions.println(files);
              if (!e.target.files.length) return;
              const folder = e.target.files[0].webkitRelativePath.split("/")[0];
              actions.println("Picked folder:" + folder);
              e.target.value = ""; // reset after handling toolkit doesn't trigger change event if the same folder is selected again
            }),
            trait.style("backgroundColor", theme.button.bg),
            trait.style("border", `1px solid ${theme.button.text}`),
            trait.style("color", theme.button.text),
            trait.style("fontSize", theme.button.fontSize.sm),
            trait.style("padding", theme.box.space.sm),
            trait.text("Add Folder"),
          ),
        ],
        state.folderListState,
      ),
    ),
    // body
    tag.div(
      trait.style("display", "flex"),
      trait.style("flexDirection", "column"),
      trait.style("flex", "1"),
      trait.style("overflow", "scroll"),
      trait.style("width", "100%"),
      // scripts
      tag.div(
        trait.style("display", "grid"),
        trait.style("width", "100%"),
        trait.style("gridTemplateColumns", "repeat(auto-fit, minmax(200px, 1fr))"),
        trait.style("gap", theme.box.space.md),
        trait.style("border", `1px solid red`, state.devModeState.$test(true)),
      ),
    ),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (root) root.append(UI());
});
