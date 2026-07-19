/**
 * Browser automation step builder (ticket 99 slice 2-3): vertical list of step
 * cards with expand/edit/reorder/enable/disable/delete controls. Each step
 * type has its own editor fields. Per-step "play" and top-level "run all".
 * Slice 3 adds recording mode and coordinate authoring.
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  FileText,
  MousePointer,
  Navigation,
  Play,
  Plus,
  Save,
  Terminal,
  Trash2,
  Type,
  Video,
} from "lucide-react";
import { useState } from "react";
import type { BrowserAutomationConfig, BrowserStep, SelectorCandidate } from "../../../shared/types";
import { api } from "../../rpc";

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const fieldLabel = "text-[12px] font-medium text-white/60";
const buttonBase =
  "rounded-md px-2.5 py-1 text-[12px] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed";

interface StepBuilderProps {
  projectPath: string;
  slug: string;
  config: BrowserAutomationConfig;
  onSave: (config: BrowserAutomationConfig) => void;
  readOnly?: boolean;
}

const STEP_TYPE_ICON = {
  navigate: Navigation,
  recorded: Video,
  click: MousePointer,
  type: Type,
  select: FileText,
  wait: Clock,
  extract: FileText,
  assert: Eye,
  screenshot: Terminal,
  coordinate: MousePointer,
} as const;

const STEP_TYPE_LABEL = {
  navigate: "Navigate",
  recorded: "Recorded",
  click: "Click",
  type: "Type",
  select: "Select",
  wait: "Wait",
  extract: "Extract",
  assert: "Assert",
  screenshot: "Screenshot",
  coordinate: "Coordinate",
} as const;

function freshStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function StepBuilder({ projectPath, slug, config, onSave, readOnly }: StepBuilderProps) {
  const [steps, setSteps] = useState<BrowserStep[]>(config.steps);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [stepTrace, setStepTrace] = useState<Map<string, string[]>>(new Map());
  const [recording, setRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordStartUrl, setRecordStartUrl] = useState("");
  const [showRecordPrompt, setShowRecordPrompt] = useState(false);

  const save = async () => {
    const updated: BrowserAutomationConfig = { steps };
    await api.saveBrowserConfig(projectPath, slug, updated);
    onSave(updated);
  };

  const addStep = (type: BrowserStep["type"]) => {
    const id = freshStepId();
    let newStep: BrowserStep;
    switch (type) {
      case "navigate":
        newStep = { id, type: "navigate", name: "Navigate", enabled: true, url: "" };
        break;
      case "click":
        newStep = { id, type: "click", name: "Click", enabled: true, selectors: [] };
        break;
      case "type":
        newStep = { id, type: "type", name: "Type", enabled: true, selectors: [], value: "" };
        break;
      case "select":
        newStep = { id, type: "select", name: "Select", enabled: true, selectors: [], value: "" };
        break;
      case "wait":
        newStep = { id, type: "wait", name: "Wait", enabled: true, for: "delay", ms: 1000 };
        break;
      case "extract":
        newStep = { id, type: "extract", name: "Extract", enabled: true, selectors: [], outputName: "" };
        break;
      case "assert":
        newStep = { id, type: "assert", name: "Assert", enabled: true, selectors: [], textContains: "", message: "" };
        break;
      case "screenshot":
        newStep = { id, type: "screenshot", name: "Screenshot", enabled: true, label: "" };
        break;
      case "coordinate":
        newStep = {
          id,
          type: "coordinate",
          name: "Coordinate action",
          enabled: true,
          x: 0,
          y: 0,
          event: "click",
          viewport: { width: 1920, height: 1080, dpr: 1.0 },
        };
        break;
      default:
        // recorded steps are only created via the recorder
        return;
    }
    setSteps([...steps, newStep]);
    setOpenStepId(id);
    setAddMenuOpen(false);
  };

  const updateStep = (id: string, update: Partial<BrowserStep>) => {
    setSteps(steps.map((s) => (s.id === id ? ({ ...s, ...update } as BrowserStep) : s)));
  };

  const deleteStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
    if (openStepId === id) setOpenStepId(null);
  };

  const moveStep = (id: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === steps.length - 1) return;
    const newSteps = [...steps];
    const target = direction === "up" ? idx - 1 : idx + 1;
    [newSteps[idx], newSteps[target]] = [newSteps[target]!, newSteps[idx]!];
    setSteps(newSteps);
  };

  const playStep = async (step: BrowserStep) => {
    setRunningStepId(step.id);
    setStepTrace(new Map(stepTrace.set(step.id, ["Running..."])));
    try {
      const res = await api.runBrowserStep(projectPath, slug, step.id, {});
      if (res.ok && res.trace) {
        setStepTrace(new Map(stepTrace.set(step.id, res.trace)));
      } else {
        setStepTrace(new Map(stepTrace.set(step.id, [res.error ?? "Unknown error"])));
      }
    } catch (err) {
      setStepTrace(new Map(stepTrace.set(step.id, [String(err)])));
    } finally {
      setRunningStepId(null);
    }
  };

  const runAll = async () => {
    // TODO: implement run-all via the normal submitRun path (check AppContext)
    // For now, just show a placeholder message
    alert("Run-all not yet implemented — use the normal task run flow");
  };

  const startRecording = async () => {
    // Prompt for start URL (default to first navigate step's URL if present)
    const firstNav = steps.find((s) => s.type === "navigate");
    const defaultUrl = firstNav && "url" in firstNav ? firstNav.url : "https://";
    setRecordStartUrl(defaultUrl);
    setShowRecordPrompt(true);
  };

  const confirmStartRecording = async () => {
    setShowRecordPrompt(false);
    if (!recordStartUrl) return;

    const res = await api.startBrowserRecording(recordStartUrl);
    if (res.ok && res.recordingId) {
      setRecording(true);
      setRecordingId(res.recordingId);
    } else {
      alert(`Failed to start recording: ${res.error ?? "Unknown error"}`);
    }
  };

  const stopRecording = async () => {
    if (!recordingId) return;

    const res = await api.stopBrowserRecording(recordingId);
    if (res.ok && res.events) {
      // Create a new "recorded" step with the captured events
      const id = freshStepId();
      const newStep: BrowserStep = {
        id,
        type: "recorded",
        name: "Recorded interaction",
        enabled: true,
        events: res.events,
      };
      setSteps([...steps, newStep]);
      setOpenStepId(id);
    } else {
      alert(`Failed to stop recording: ${res.error ?? "Unknown error"}`);
    }

    setRecording(false);
    setRecordingId(null);
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {readOnly && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-200">
          This task is adopted — editing will create a new version.
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-white">Browser Automation Steps</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            disabled={readOnly}
            className={`${buttonBase} flex items-center gap-1.5 ${
              recording ? "bg-red-500/20 text-red-400 ring-1 ring-red-400/50" : "text-white"
            }`}
          >
            <Circle size={13} className={recording ? "fill-current" : ""} />
            {recording ? "Stop Recording" : "Record"}
          </button>
          <button
            onClick={runAll}
            disabled={readOnly || steps.length === 0}
            className={`${buttonBase} flex items-center gap-1.5 text-white`}
          >
            <Play size={13} />
            Run All
          </button>
          <button
            onClick={save}
            disabled={readOnly}
            className={`${buttonBase} flex items-center gap-1.5 bg-white/10 text-white`}
          >
            <Save size={13} />
            Save
          </button>
        </div>
      </div>

      {showRecordPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowRecordPrompt(false)}
        >
          <div
            className="rounded-lg border border-clide-border bg-clide-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-[14px] font-bold text-white">Start Recording</h3>
            <label className={`${fieldLabel} mb-1 block`}>Start URL</label>
            <input
              className={`${inputBase} mb-3 w-[400px]`}
              value={recordStartUrl}
              onChange={(e) => setRecordStartUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRecordPrompt(false)} className={`${buttonBase} text-white/70`}>
                Cancel
              </button>
              <button onClick={confirmStartRecording} className={`${buttonBase} bg-white/10 text-white`}>
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setAddMenuOpen(!addMenuOpen)}
          disabled={readOnly}
          className={`${buttonBase} flex items-center gap-1.5 text-white/70 ring-1 ring-white/10 hover:ring-white/20`}
        >
          <Plus size={13} />
          Add Step
        </button>
        {addMenuOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 rounded-md border border-clide-border bg-clide-surface py-1 shadow-lg">
            {(
              ["navigate", "click", "type", "select", "wait", "extract", "assert", "screenshot", "coordinate"] as const
            ).map((type) => (
              <button
                key={type}
                onClick={() => addStep(type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-white hover:bg-white/5"
              >
                {STEP_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {steps.length === 0 && (
          <div className="rounded-md border border-clide-border bg-clide-bg px-4 py-6 text-center text-[13px] text-white/40">
            No steps yet — click "Add Step" to begin
          </div>
        )}
        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            index={idx}
            total={steps.length}
            open={openStepId === step.id}
            onToggle={() => setOpenStepId(openStepId === step.id ? null : step.id)}
            onUpdate={(update) => updateStep(step.id, update)}
            onDelete={() => deleteStep(step.id)}
            onMove={moveStep}
            onPlay={() => playStep(step)}
            running={runningStepId === step.id}
            trace={stepTrace.get(step.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

interface StepCardProps {
  step: BrowserStep;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onUpdate: (update: Partial<BrowserStep>) => void;
  onDelete: () => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onPlay: () => void;
  running: boolean;
  trace?: string[];
  readOnly?: boolean;
}

function StepCard({
  step,
  index,
  total,
  open,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
  onPlay,
  running,
  trace,
  readOnly,
}: StepCardProps) {
  const Icon = STEP_TYPE_ICON[step.type];

  return (
    <div className="rounded-md border border-clide-border bg-clide-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="text-white/40 hover:text-white">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Icon size={14} className="text-white/60" />
        <span className="flex-1 text-[13px] text-white">
          {index + 1}. {step.name ?? STEP_TYPE_LABEL[step.type]}
        </span>
        <input
          type="checkbox"
          checked={step.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          disabled={readOnly}
          className="h-4 w-4"
        />
        <button
          onClick={() => onMove(step.id, "up")}
          disabled={readOnly || index === 0}
          className={`${buttonBase} text-white/40`}
        >
          <ArrowUp size={13} />
        </button>
        <button
          onClick={() => onMove(step.id, "down")}
          disabled={readOnly || index === total - 1}
          className={`${buttonBase} text-white/40`}
        >
          <ArrowDown size={13} />
        </button>
        <button onClick={onPlay} disabled={readOnly || running} className={`${buttonBase} text-white/70`}>
          <Play size={13} />
        </button>
        <button onClick={onDelete} disabled={readOnly} className={`${buttonBase} text-red-400`}>
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="border-t border-clide-border px-3 py-3">
          <StepEditor step={step} onUpdate={onUpdate} readOnly={readOnly} />
          {trace && trace.length > 0 && (
            <div className="mt-3 rounded border border-clide-border bg-clide-bg p-2 font-mono text-[11px] text-white/70">
              {trace.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StepEditorProps {
  step: BrowserStep;
  onUpdate: (update: Partial<BrowserStep>) => void;
  readOnly?: boolean;
}

function StepEditor({ step, onUpdate, readOnly }: StepEditorProps) {
  switch (step.type) {
    case "navigate":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>URL (supports {"{{fields.x}}"} expressions)</label>
          <input
            className={inputBase}
            placeholder="https://example.com"
            value={step.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "recorded":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Recorded Events ({step.events.length})</label>
          <div className="flex flex-col gap-1 rounded border border-clide-border bg-clide-bg p-2">
            {step.events.map((event, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="font-mono text-white/80">{event.kind}</span>
                <span className="flex-1 truncate">
                  {event.selectors[0]?.strategy}:{event.selectors[0]?.selector}
                </span>
                {event.value && <span className="text-white/40">= {event.value.slice(0, 20)}</span>}
                <button
                  onClick={() => {
                    const updated = step.events.filter((_, idx) => idx !== i);
                    onUpdate({ events: updated });
                  }}
                  disabled={readOnly}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {step.events.length === 0 && <div className="text-[11px] text-white/40">No events</div>}
          </div>
        </div>
      );

    case "click":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Selectors (one per line, strategy:selector)</label>
          <SelectorListEditor
            selectors={step.selectors}
            onChange={(selectors) => onUpdate({ selectors })}
            readOnly={readOnly}
          />
        </div>
      );

    case "type":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Selectors</label>
          <SelectorListEditor
            selectors={step.selectors}
            onChange={(selectors) => onUpdate({ selectors })}
            readOnly={readOnly}
          />
          <label className={fieldLabel}>Value (supports {"{{fields.x}}"} expressions)</label>
          <input
            className={inputBase}
            value={step.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Selectors</label>
          <SelectorListEditor
            selectors={step.selectors}
            onChange={(selectors) => onUpdate({ selectors })}
            readOnly={readOnly}
          />
          <label className={fieldLabel}>Value</label>
          <input
            className={inputBase}
            value={step.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "wait":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Wait for</label>
          <select
            className={inputBase}
            value={step.for}
            onChange={(e) => onUpdate({ for: e.target.value as "selector" | "navigation" | "delay" })}
            disabled={readOnly}
          >
            <option value="delay">Fixed delay</option>
            <option value="selector">Selector appears</option>
            <option value="navigation">Navigation completes</option>
          </select>
          {step.for === "delay" && (
            <>
              <label className={fieldLabel}>Milliseconds</label>
              <input
                type="number"
                className={inputBase}
                value={step.ms ?? 1000}
                onChange={(e) => onUpdate({ ms: parseInt(e.target.value) || 1000 })}
                disabled={readOnly}
              />
            </>
          )}
          {step.for === "selector" && (
            <>
              <label className={fieldLabel}>CSS Selector</label>
              <input
                className={inputBase}
                value={step.selector ?? ""}
                onChange={(e) => onUpdate({ selector: e.target.value })}
                disabled={readOnly}
              />
            </>
          )}
        </div>
      );

    case "extract":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Selectors</label>
          <SelectorListEditor
            selectors={step.selectors}
            onChange={(selectors) => onUpdate({ selectors })}
            readOnly={readOnly}
          />
          <label className={fieldLabel}>Attribute (leave empty for text content)</label>
          <input
            className={inputBase}
            value={step.attribute ?? ""}
            onChange={(e) => onUpdate({ attribute: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Output Name</label>
          <input
            className={inputBase}
            placeholder="e.g., uploadUrl"
            value={step.outputName}
            onChange={(e) => onUpdate({ outputName: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "assert":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Selectors</label>
          <SelectorListEditor
            selectors={step.selectors}
            onChange={(selectors) => onUpdate({ selectors })}
            readOnly={readOnly}
          />
          <label className={fieldLabel}>Text contains</label>
          <input
            className={inputBase}
            value={step.textContains ?? ""}
            onChange={(e) => onUpdate({ textContains: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Error message</label>
          <input
            className={inputBase}
            value={step.message ?? ""}
            onChange={(e) => onUpdate({ message: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "screenshot":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Label (optional)</label>
          <input
            className={inputBase}
            value={step.label ?? ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={readOnly}
          />
        </div>
      );

    case "coordinate":
      return (
        <div className="flex flex-col gap-2">
          <label className={fieldLabel}>Name</label>
          <input
            className={inputBase}
            value={step.name ?? ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
          />
          <label className={fieldLabel}>Event type</label>
          <select
            className={inputBase}
            value={step.event}
            onChange={(e) => onUpdate({ event: e.target.value as "click" | "dblclick" })}
            disabled={readOnly}
          >
            <option value="click">Click</option>
            <option value="dblclick">Double-click</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={fieldLabel}>X coordinate</label>
              <input
                type="number"
                className={inputBase}
                value={step.x}
                onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className={fieldLabel}>Y coordinate</label>
              <input
                type="number"
                className={inputBase}
                value={step.y}
                onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
                disabled={readOnly}
              />
            </div>
          </div>
          <label className={fieldLabel}>Viewport dimensions</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={`${fieldLabel} text-[10px]`}>Width</label>
              <input
                type="number"
                className={inputBase}
                value={step.viewport.width}
                onChange={(e) => onUpdate({ viewport: { ...step.viewport, width: parseInt(e.target.value) || 1920 } })}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className={`${fieldLabel} text-[10px]`}>Height</label>
              <input
                type="number"
                className={inputBase}
                value={step.viewport.height}
                onChange={(e) => onUpdate({ viewport: { ...step.viewport, height: parseInt(e.target.value) || 1080 } })}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className={`${fieldLabel} text-[10px]`}>DPR</label>
              <input
                type="number"
                step="0.1"
                className={inputBase}
                value={step.viewport.dpr}
                onChange={(e) => onUpdate({ viewport: { ...step.viewport, dpr: parseFloat(e.target.value) || 1.0 } })}
                disabled={readOnly}
              />
            </div>
          </div>
          <label className={fieldLabel}>Reference screenshot label (optional)</label>
          <input
            className={inputBase}
            placeholder="e.g., login-button.png"
            value={step.referenceShot ?? ""}
            onChange={(e) => onUpdate({ referenceShot: e.target.value })}
            disabled={readOnly}
          />
          <div className="rounded-md bg-amber-400/5 px-2 py-1.5 text-[11px] text-amber-200">
            Note: Full click-on-live-view picker is follow-up work. For now, manually enter coordinates.
          </div>
        </div>
      );

    default:
      return null;
  }
}

interface SelectorListEditorProps {
  selectors: SelectorCandidate[];
  onChange: (selectors: SelectorCandidate[]) => void;
  readOnly?: boolean;
}

function SelectorListEditor({ selectors, onChange, readOnly }: SelectorListEditorProps) {
  const [text, setText] = useState(selectors.map((s) => `${s.strategy}:${s.selector}`).join("\n"));

  const handleBlur = () => {
    const parsed: SelectorCandidate[] = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [strategy, ...rest] = line.split(":");
        return {
          strategy: (strategy?.trim() ?? "css") as SelectorCandidate["strategy"],
          selector: rest.join(":").trim(),
        };
      });
    onChange(parsed);
  };

  return (
    <textarea
      className={`${inputBase} min-h-[80px] font-mono text-[12px]`}
      placeholder="testid:submit-button&#10;css:#submit"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      disabled={readOnly}
    />
  );
}
