import { useEffect, useRef, useState, type ReactNode } from "react";

interface AutoSizeOutputProps {
  children: ReactNode;
  className?: string;
  /** Natural-growth ceiling: content taller than this scrolls instead. */
  capHeight?: number;
  /** Drag ceiling once the user has resized manually. */
  maxHeight?: number;
}

/**
 * Scroll container for run results that shrinks to fit: small outputs take
 * only the height they need, anything taller than `capHeight` scrolls. The
 * resize handle still works — dragging writes an inline height, which the
 * MutationObserver detects to lift the cap so the user can grow the box up
 * to `maxHeight`. Replaces the old fixed 400px boxes that dwarfed two-line
 * results.
 */
export default function AutoSizeOutput({
  children,
  className = "",
  capHeight = 400,
  maxHeight = 1000,
}: AutoSizeOutputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [userSized, setUserSized] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || userSized) return;
    const observer = new MutationObserver(() => {
      if (el.style.height) setUserSized(true);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, [userSized]);

  return (
    <div
      ref={ref}
      className={`clide-scroll resize-y overflow-auto ${className}`}
      style={{ minHeight: 40, maxHeight: userSized ? maxHeight : capHeight }}
    >
      {children}
    </div>
  );
}
