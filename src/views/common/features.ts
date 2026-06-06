import { actions } from "./actions";
import { state } from "./states";
import { tag, trait } from "./templates";
import { theme } from "./theme";

function FormModal() {
  const modalExists = state.formModal.$test((v) => v !== null);
  const modalNotExists = state.formModal.$test((v) => v === null);

  return tag.form(
    trait.style("backgroundColor", theme.modal.backdrop),
    trait.style("backdropFilter", "blur(5px)"),
    trait.style("border", `1px solid red`, state.devModeState.$test(true)),
    trait.style("display", "grid", modalExists),
    trait.style("display", "none", modalNotExists),
    trait.style("gridTemplateRows", "max-content 1fr max-content"),
    trait.style("gap", "10px"),
    trait.style("height", "100vh"),
    trait.style("width", "100vw"),
    trait.style("position", "fixed"),
    trait.style("zIndex", "1000"),
    trait.style("padding", theme.box.space.lg),
    trait.evt("submit", (e: any) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      actions.submitForm(formData);
    }),

    trait.html(
      () => [
        // modal header
        tag.div(
          trait.style("display", "flex"),
          trait.style("flexDirection", "column"),
          trait.style("color", theme.modal.header.text),
          trait.style("fontSize", theme.modal.header.fontSize),
          tag.div(
            trait.style("color", theme.modal.header.text),
            trait.style("fontWeight", "bold"),
            trait.style("fontSize", theme.modal.header.fontSize),
            trait.text(() => state.formModal.val()?.label),
          ),
          tag.div(
            trait.style("color", theme.modal.header.text),
            trait.style("fontSize", theme.modal.header.fontSize),
            trait.style("opacity", "0.6"),
            trait.text(() => state.formModal.val()?.description),
          ),
        ),
        // modal body
        tag.div(
          trait.style("display", "flex"),
          trait.style("flexDirection", "column"),
          trait.style("gap", "10px"),
          trait.style("alignItems", "flex-start"),
          trait.style("justifyContent", "flex-start"),
          trait.style("color", theme.modal.body.text),
          trait.style("fontSize", theme.modal.body.fontSize),

          // form fields
          ...Object.entries(state.formModal.val()?.fields || {}).map(([key, field], index) =>
            tag.input(
              trait.attr("name", key),
              trait.attr("placeholder", field.placeholder),
              trait.focus([() => index === 0], [state.formModal]),
              trait.style("width", "100%"),
              trait.style("backgroundColor", theme.input.bg),
              trait.style("color", theme.input.text),
              trait.style("border", `1px solid ${theme.input.border}`),
              trait.style("fontSize", theme.input.fontSize.md),
              trait.style("padding", theme.input.padding),
              trait.attr("required", field.validation.required ? "required" : undefined),
            ),
          ),
        ),
        // footer
        tag.div(
          tag.button(
            trait.attr("type", "submit"),
            trait.text("Submit"),
            trait.style("backgroundColor", theme.button.bg),
            trait.style("color", theme.button.text),
            trait.style("border", "none"),
            trait.style("fontSize", theme.button.fontSize.md),
            trait.style("padding", "10px"),
            trait.style("cursor", "pointer"),
          ),
          // tag.button(
          //   trait.text("Cancel"),
          //   trait.style("backgroundColor", theme.button.bg),
          //   trait.style("color", theme.button.text),
          //   trait.style("border", "none"),
          //   trait.style("fontSize", theme.button.fontSize.md),
          //   trait.style("padding", "10px"),
          //   trait.style("cursor", "pointer"),
          //   trait.evt("click", state.formModal.$set(null)),
          // ),
        ),
      ],
      state.formModal,
    ),
  );
}

export const features = {
  FormModal,
};
