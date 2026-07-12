import { useEffect, type ReactNode } from "react";

/**
 * Escape always closes the surface — registered on `window`, so it works no
 * matter where focus is (a backdrop-div onKeyDown only fires with focus
 * inside the modal, which is how Escape-dead modals happen).
 *
 * Layering note: the confirm dialog (UIFeedback) uses a capture-phase
 * listener with stopPropagation, so when it's stacked above a modal, Escape
 * closes only the dialog — listeners registered here never see that press.
 */
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, enabled]);
}

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Panel width utility, e.g. "w-[480px]". */
  widthClassName?: string;
  /** Extra panel classes (layout/scroll), e.g. "flex max-h-[85%] flex-col overflow-hidden". */
  panelClassName?: string;
  /** Backdrop vertical placement, e.g. "pt-10". */
  backdropClassName?: string;
}

/**
 * THE modal pattern (ticket 75): dimmed backdrop, centered panel, and the
 * app-wide guarantees every modal must honor — Escape closes (window-level,
 * focus-independent), backdrop click closes, clicks inside don't. New
 * modals wrap their content in this instead of hand-rolling a backdrop so
 * those guarantees can't be forgotten.
 */
export default function Modal({
  onClose,
  children,
  widthClassName = "w-[480px]",
  panelClassName = "",
  backdropClassName = "pt-16",
}: ModalProps) {
  useEscapeToClose(onClose);

  return (
    <div
      className={`absolute inset-0 z-40 flex items-start justify-center bg-black/50 ${backdropClassName}`}
      onMouseDown={onClose}
    >
      <div
        className={`${widthClassName} rounded-lg border border-clide-border bg-clide-panel shadow-2xl ${panelClassName}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
