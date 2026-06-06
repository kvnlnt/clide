import { State } from "@linttrap/oem";
import { FormSubmissionType, FormType } from "../../common/types";
import { actions } from "./actions";

const appState = State<"LIST">("LIST");
const devModeState = State(false);
const formSearchInput = State("");

const formsCollection = State<FormType[]>([
  {
    label: "Form 1",
    description: "This is form 1",
    fields: {
      name: {
        label: "Name",
        placeholder: "Enter value for Name",
        validation: {
          required: true,
        },
      },
      email: {
        label: "Email",
        placeholder: "Enter value for Email",
        validation: {
          required: true,
        },
      },
    },
  },
  {
    label: "Form 2",
    description: "This is form 2",
    fields: {
      Username: {
        label: "Username",
        placeholder: "Enter value for Username",
        validation: {
          required: true,
        },
      },
      Password: {
        label: "Password",
        placeholder: "Enter value for Password",
        validation: {
          required: true,
        },
      },
    },
  },
]);

formsCollection.sub((forms) => {
  actions.println("Forms collection updated: " + JSON.stringify(forms));
});

const formModal = State<FormType | null>({
  ...formsCollection.val()[0],
});

const formSubmissionCollection = State<FormSubmissionType[]>([
  {
    id: "1",
    form: formsCollection.val()[0],
    values: {
      Name: "John Doe",
      Email: "john.doe@example.com",
    },
    status: "CLEAN",
  },
  {
    id: "2",
    form: formsCollection.val()[1],
    values: {
      Username: "johndoe",
      Password: "password123",
    },
    status: "DIRTY",
  },
]);

export const state = {
  appState,
  devModeState,
  formsCollection,
  formModal,
  formSearchInput,
  formSubmissionCollection,
};
