import { RPCSchema } from "electrobun";

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
  form: Record<
    string,
    {
      type: string;
      label: string;
      description: string;
      default: string;
      placeholder: string;
      validation: {
        required: boolean;
        minLength: number;
        maxLength: number;
      };
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
        params: { title: string; url: string; frame: { width: number; height: number; x: number; y: number } };
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
