import { RPCSchema } from "electrobun";

export type FormType = {
  label: string;
  description: string;
  fields: {
    [key: string]: {
      label: string;
      placeholder: string;
      validation: {
        required: boolean;
      };
    };
  };
};

export type FormSubmissionType = {
  id: string;
  form: FormType;
  values: Record<string, string>;
  status: "CLEAN" | "DIRTY" | "PROCESSING" | "DONE" | "ERROR";
};

export type ScriptType = {
  name: string;
  icon: string;
  description: string;
  script: string;
  dependencies: Record<
    string,
    {
      version: string;
      description: string;
      install: string;
    }
  >;
};

export type RPCType = {
  // functions that execute in the main process
  bun: RPCSchema<{
    requests: {
      println: {
        params: string;
        response: void;
      };
      launchWin: {
        params: {
          title: string;
          url: string;
          frame: { width: number; height: number; x: number; y: number };
        };
        response: void;
      };
    };
    messages: {
      logToBun: {
        msg: string;
      };
    };
  }>;
  // functions that execute in the browser context
  webview: RPCSchema<{
    requests: {
      launchWin: {
        params: { title: string; url: string };
        response: void;
      };
    };
    messages: {
      logToWebview: {
        msg: string;
      };
    };
  }>;
};
