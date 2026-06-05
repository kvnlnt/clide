import { Electroview } from "electrobun/view";
import { RPCType, ScriptType } from "../../common/types";

const electroview = new Electroview({
  rpc: Electroview.defineRPC<RPCType>({
    handlers: {
      requests: {}, // nothing — Bun never calls into the browser
      messages: {},
    },
  }),
});

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

export const actions = { launchScript, println };
