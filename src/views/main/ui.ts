import { actions } from "../common/actions";
import { components } from "../common/components";
import { state } from "../common/states";
import { tag, trait } from "../common/templates";
import { theme } from "../common/theme";

export function UI() {
  return tag.div(
    trait.style("display", "flex"),
    trait.style("justifyContent", "flexStart"),
    trait.style("alignItems", "flexStart"),
    trait.style("flexDirection", "column"),
    trait.style("height", "100vh"),
    trait.style("maxHeight", "100vh"),
    // trait.style("overflow", "hidden"),
    trait.style("backgroundColor", theme.box.bg),
    trait.style("color", theme.text.primary),
    trait.style("border", `1px solid red`, state.devModeState.$test(true)),
    trait.style("width", "100vw"),
    trait.style("padding", theme.box.space.lg),
    trait.style("gap", theme.box.space.lg),
    // form selector
    tag.form(
      trait.style("display", "flex"),
      trait.evt("submit", (e: any) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const choice = formData.get("choice");
        actions.loadForm(choice as string);
      }),
      tag.input(
        trait.attr("list", "options"),
        trait.attr("name", "choice"),
        trait.attr("placeholder", "Type or select..."),
        trait.style("width", "100vw"),
      ),
      tag.datalist(
        trait.attr("id", "options"),
        trait.html(() =>
          state.formsCollection
            .val()
            .map((form) =>
              tag.option(
                trait.attr("value", form.label),
                trait.text(form.description),
              ),
            ),
        ),
      ),
    ),
    // form submissions
    tag.div(
      trait.style("display", "flex"),
      trait.style("flexDirection", "column"),
      trait.style("gap", "10px"),
      trait.html(() =>
        state.formSubmissionCollection.val().map(components.formSubmissionCard),
      ),
    ),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (root) root.append(UI());
});
