import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions. Default true — most confirms here are deletes. */
  danger?: boolean;
  /** Optional checkbox under the message (e.g. "Also delete the copied executable"). */
  checkboxLabel?: string;
  checkboxDefault?: boolean;
}

export interface ConfirmResult {
  ok: boolean;
  /** State of the optional checkbox at confirm time; false when none was shown or on cancel. */
  checked: boolean;
}

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface PendingConfirm {
  key: number;
  opts: ConfirmOptions;
  resolve: (result: ConfirmResult) => void;
}

interface UIFeedbackValue {
  /** Popup confirmation dialog — resolves when the user chooses. Never throws. */
  confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
  /** Transient result notice, bottom-center, auto-dismissing. */
  toast: (message: string, kind?: ToastKind) => void;
  /** Layer internals. */
  _pending: PendingConfirm | null;
  _toasts: ToastItem[];
  _dismissToast: (id: number) => void;
}

const UIFeedbackContext = createContext<UIFeedbackValue | null>(null);

export function useUIFeedback(): Pick<UIFeedbackValue, "confirm" | "toast"> {
  const ctx = useContext(UIFeedbackContext);
  if (!ctx) throw new Error("useUIFeedback must be used within UIFeedbackProvider");
  return ctx;
}

const TOAST_DURATION_MS = 3500;

export function UIFeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<ConfirmResult>((resolve) => {
      setPending((cur) => {
        // A second confirm while one is open cancels the first — never stack dialogs.
        cur?.resolve({ ok: false, checked: false });
        const key = ++seq.current;
        return {
          key,
          opts,
          // Resolving must also dismiss the dialog — clearing pending here
          // rather than in the dialog keeps close-on-choice unforgettable.
          resolve: (result: ConfirmResult) => {
            setPending((p) => (p?.key === key ? null : p));
            resolve(result);
          },
        };
      });
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return (
    <UIFeedbackContext.Provider value={{ confirm, toast, _pending: pending, _toasts: toasts, _dismissToast: dismissToast }}>
      {children}
    </UIFeedbackContext.Provider>
  );
}

/**
 * Renders the confirm dialog + toast stack. Mounted inside the Workspace
 * root (not portaled to body) so it's clipped by the window's rounded
 * corners, and above the z-50 full-window overlays so confirmations work
 * from Settings and the wizard too.
 */
export function UIFeedbackLayer() {
  const ctx = useContext(UIFeedbackContext);
  if (!ctx) return null;
  const { _pending, _toasts, _dismissToast } = ctx;

  return (
    <>
      {_pending && <ConfirmDialog key={_pending.key} pending={_pending} />}

      {_toasts.length > 0 && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[110] flex -translate-x-1/2 flex-col items-center gap-2">
          {_toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => _dismissToast(t.id)}
              className="pointer-events-auto flex items-center gap-2 rounded-lg border border-clide-border bg-clide-panel px-3.5 py-2 text-[13px] text-white shadow-2xl"
            >
              {t.kind === "success" ? (
                <CheckCircle2 size={14} className="shrink-0 text-green-400" />
              ) : (
                <XCircle size={14} className="shrink-0 text-red-400" />
              )}
              {t.message}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ConfirmDialog({ pending }: { pending: PendingConfirm }) {
  const { opts, resolve } = pending;
  const [checked, setChecked] = useState(opts.checkboxDefault ?? false);
  const danger = opts.danger !== false;

  const cancel = () => resolve({ ok: false, checked: false });
  const ok = () => resolve({ ok: true, checked });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cancel();
      }
    };
    // Capture phase so overlays underneath (Settings/wizard Escape handlers) don't also close.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-[100] flex items-start justify-center bg-black/50 pt-28" onMouseDown={cancel}>
      <div
        className="w-[420px] overflow-hidden rounded-lg border border-clide-border bg-clide-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
          <span className="flex items-center gap-2 text-[14px] font-bold text-white">
            {danger && <AlertTriangle size={15} className="shrink-0 text-amber-300" />}
            {opts.title}
          </span>
          {opts.message && <span className="text-[13px] text-white/60">{opts.message}</span>}
          {opts.checkboxLabel && (
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-white/70">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {opts.checkboxLabel}
            </label>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5">
          <button onClick={cancel} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white">
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            autoFocus
            onClick={ok}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
              danger ? "bg-red-500/80 text-white hover:bg-red-500" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
