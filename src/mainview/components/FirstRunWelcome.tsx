import { useApp } from "../context/AppContext";
import { NewProjectForm } from "./NewProjectModal";

/**
 * Full-screen, zero-clutter first-run experience (ticket 78): the very first
 * thing a brand-new CLIDE install shows, in place of the regular welcome
 * screen (ticket 77/29) which assumes at least one known project. No project
 * list, no recents — just the brand and the one thing that matters: getting
 * a first project going.
 *
 * Finishing chains straight into the first-run AI service wizard (ticket 76)
 * as step 2 of one continuous onboarding, rather than a second takeover
 * popping in on its own later.
 */
export default function FirstRunWelcome() {
  const { openAIWizard } = useApp();

  return (
    <div className="clide-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
      <span className="clide-rise text-[11px] font-semibold uppercase tracking-wider text-white/30" style={{ animationDelay: "0ms" }}>
        Step 1 of 2
      </span>
      <div className="clide-rise mt-2 flex flex-col items-center" style={{ animationDelay: "80ms" }}>
        <h1 className="pt-2 text-[60px] font-bold text-white">CLIDE</h1>
      </div>
      <p className="clide-rise mt-1 text-[23px] italic text-white/30" style={{ animationDelay: "180ms" }}>
        Your Automation Workhorse
      </p>
      <p
        className="clide-rise mt-4 max-w-[380px] text-center text-[14px] text-white/50"
        style={{ animationDelay: "260ms" }}
      >
        Your command line, as friendly forms. Let's get your first project going.
      </p>

      <div
        className="clide-rise mt-8 w-[420px] overflow-hidden rounded-lg border border-white/10 bg-clide-panel/60"
        style={{ animationDelay: "380ms" }}
      >
        <NewProjectForm onDone={() => openAIWizard(true)} />
      </div>
    </div>
  );
}
