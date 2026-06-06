import { Electroview } from "electrobun/view";
import { RPCType, ScriptType } from "../../common/types";
import { state } from "./states";

const electroview = new Electroview({
  rpc: Electroview.defineRPC<RPCType>({
    handlers: {
      requests: {}, // nothing — Bun never calls into the browser
      messages: {},
    },
  }),
});

function submitForm(formData: FormData) {
  const guid = crypto.randomUUID();
  const values = Object.fromEntries(formData.entries()) as Record<string, string>;

  state.formSubmissionCollection.reduce((prev) => [
    {
      id: guid,
      form: state.formModal.val()!,
      values: values,
      status: "CLEAN",
    },
    ...prev,
  ]);

  state.formModal.set(null);
  state.formSearchInput.set("");
}

function loadForm(formLabel: string) {
  const form = state.formsCollection.val().find((f) => f.label === formLabel);
  if (!form) {
    electroview.rpc?.request.println("Form not found");
    return;
  }
  electroview.rpc?.request.println(JSON.stringify(form));
  state.formModal.set(form);
}

async function launchScript(i: ScriptType) {
  await electroview.rpc?.request.launchWin({
    title: i.name,
    url: "views://scriptview/index.html",
    frame: {
      width: 500,
      height: 500,
      x: 150,
      y: 150,
    },
  });
}

function println(message: string) {
  electroview.rpc?.request.println(message);
}

export const actions = { launchScript, println, loadForm, submitForm };
