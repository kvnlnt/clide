import { scriptFilterState } from "../views/common/states";
import { ScriptType } from "./types";

function byScriptFilter(item: ScriptType) {
  return (
    item.name.toLowerCase().includes(scriptFilterState.val().toLowerCase()) ||
    item.description.toLowerCase().includes(scriptFilterState.val().toLowerCase())
  );
}

export const filter = {
  byScriptFilter,
};
