import { State } from "@linttrap/oem";
import { FormSubmissionType } from "../../common/types";
import { tag, trait } from "./templates";
import { theme } from "./theme";

function formSubmissionCard(submission: FormSubmissionType) {
  const expanded = State(false);

  return tag.div(
    trait.style("color", theme.formSubmissionCard.label.text),
    trait.style("fontSize", theme.formSubmissionCard.label.fontSize),
    trait.style("backgroundColor", theme.formSubmissionCard.bg),
    trait.html(
      () => [
        // card header
        tag.div(
          trait.style("padding", theme.formSubmissionCard.padding),
          trait.styleOnEvt("mouseover", "backgroundColor", theme.formSubmissionCard.bgHover),
          trait.styleOnEvt("mouseout", "backgroundColor", theme.formSubmissionCard.bg),
          trait.style("cursor", "pointer"),
          trait.style("display", "flex"),
          trait.style("justifyContent", "space-between"),
          trait.style("alignItems", "center"),
          trait.evt(
            "click",
            expanded.$reduce((s) => !s),
          ),

          // card title
          tag.div(
            trait.style("display", "flex"),
            trait.style("alignItems", "center"),
            trait.style("gap", "10px"),
            trait.text(submission.form.label),
            tag.div(trait.style("fontSize", "0.7em"), trait.style("opacity", "0.5"), trait.text(submission.id)),
          ),

          // card status
          tag.div(
            trait.style("display", "flex"),
            trait.style("alignItems", "center"),
            trait.style("gap", "10px"),
            tag.div(trait.style("fontSize", "0.7em"), trait.style("opacity", "0.5"), trait.text(submission.status)),
            tag.div(
              trait.style("backgroundColor", "red"),
              trait.style("height", "10px"),
              trait.style("width", "10px"),
              trait.style("borderRadius", "50%"),
              trait.style(
                "backgroundColor",
                submission.status === "CLEAN"
                  ? "green"
                  : submission.status === "DIRTY"
                    ? "yellow"
                    : submission.status === "ERROR"
                      ? "red"
                      : "gray",
              ),
            ),
          ),
        ),

        // card body
        tag.div(
          trait.style("padding", theme.formSubmissionCard.padding),
          trait.style("display", "flex", expanded.$test(true)),
          trait.style("display", "none", expanded.$test(false)),
          trait.style("flexDirection", "column"),
          trait.style("gap", "5px"),
          trait.style("color", theme.formSubmissionCard.body.text),
          trait.style("fontSize", theme.formSubmissionCard.body.fontSize),
          trait.html(
            Object.entries(submission.values).map(([key, value]) =>
              tag.div(
                trait.style("display", "flex"),
                trait.style("justifyContent", "space-between"),
                trait.style("alignItems", "center"),
                trait.text(`${key}: ${value}`),
              ),
            ),
          ),
        ),
      ],
      expanded,
    ),
  );
}

export const components = {
  formSubmissionCard,
};
