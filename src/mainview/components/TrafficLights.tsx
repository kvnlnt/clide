import { Minus, X } from "lucide-react";
import { api } from "../rpc";

/** Close/minimize window buttons — shared by the header and any full-window overlay. */
export default function TrafficLights() {
  return (
    <div className="flex p-1.5 gap-2">
      <button
        className="text-black bg-red-600/30 hover:bg-red-600 rounded-full h-4 w-4 flex items-center justify-center transition-colors"
        onClick={api.closeWindow}
      >
        <X size={10} />
      </button>
      <button
        className="text-black bg-yellow-600/30 hover:bg-yellow-600 rounded-full h-4 w-4 flex items-center justify-center transition-colors"
        onClick={api.minimizeWindow}
      >
        <Minus size={10} />
      </button>
    </div>
  );
}
