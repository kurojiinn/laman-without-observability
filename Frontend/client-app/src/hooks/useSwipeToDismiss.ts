import { useEffect, useRef, useState } from "react";

// Bottom sheets: direction "down", attach handlers to drag handle pill
// Fullscreen modals: direction "right", attach handlers to the whole inner wrapper
//   → smart gesture detection: distinguishes horizontal swipe from vertical scroll
// isOpen: pass for components that stay mounted when closed (ProfileDrawer, AuthModal)
//         resets offset when modal reopens
//
// Returns:
//   style        — apply to the modal content element (translate + scale)
//   backdropStyle — apply to the backdrop overlay element (fades out as you drag)
//   handlers     — onTouchStart/Move/End
export function useSwipeToDismiss({
  onDismiss,
  threshold = 80,
  direction = "down",
  isOpen,
}: {
  onDismiss: () => void;
  threshold?: number;
  direction?: "down" | "right";
  isOpen?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startMain = useRef(0);   // coordinate in target direction
  const startOrtho = useRef(0);  // coordinate in perpendicular direction
  const currentOffset = useRef(0);
  // null = not yet determined, "target" = intercepting, "ignore" = let browser handle
  const gesture = useRef<null | "target" | "ignore">(null);

  useEffect(() => {
    if (isOpen) {
      setOffset(0);
      setDragging(false);
      currentOffset.current = 0;
      gesture.current = null;
    }
  }, [isOpen]);

  function onTouchStart(e: React.TouchEvent) {
    startMain.current  = direction === "down" ? e.touches[0].clientY : e.touches[0].clientX;
    startOrtho.current = direction === "down" ? e.touches[0].clientX : e.touches[0].clientY;
    currentOffset.current = 0;
    gesture.current = null;
    setDragging(true);
    setOffset(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    const mainCoord  = direction === "down" ? e.touches[0].clientY : e.touches[0].clientX;
    const orthoCoord = direction === "down" ? e.touches[0].clientX : e.touches[0].clientY;
    const delta      = mainCoord  - startMain.current;
    const orthoDelta = Math.abs(orthoCoord - startOrtho.current);

    // After a 5px dead zone, lock gesture type for this touch sequence
    if (gesture.current === null && (Math.abs(delta) > 5 || orthoDelta > 5)) {
      gesture.current = Math.abs(delta) > orthoDelta ? "target" : "ignore";
    }

    // Only move element if we're tracking the target direction (and moving the right way)
    if (gesture.current === "target" && delta > 0) {
      currentOffset.current = delta;
      setOffset(delta);
    }
  }

  function onTouchEnd() {
    setDragging(false);
    gesture.current = null;
    if (currentOffset.current >= threshold) {
      setOffset(1000);
      setTimeout(onDismiss, 240);
    } else {
      setOffset(0);
      currentOffset.current = 0;
    }
  }

  // Backdrop fades from 1 → 0 as offset goes 0 → 350px
  const fadeOpacity = Math.max(0, 1 - offset / 350);

  // Modal scales down slightly as it's dragged (bottom-sheet only)
  const scale = direction === "down" ? Math.max(0.88, 1 - offset * 0.00045) : 1;

  const transition = dragging
    ? "none"
    : "transform 0.24s cubic-bezier(0.32,0.72,0,1), opacity 0.24s cubic-bezier(0.32,0.72,0,1)";

  return {
    offset,
    style: {
      transform:
        direction === "down"
          ? `translateY(${offset}px) scale(${scale})`
          : `translateX(${offset}px)`,
      // Fullscreen right-swipe: fade the panel itself as it slides away
      opacity: direction === "right" ? fadeOpacity : 1,
      transition,
      willChange: "transform",
      transformOrigin: "bottom center",
    } as React.CSSProperties,
    backdropStyle: {
      opacity: fadeOpacity,
      transition: dragging ? "none" : "opacity 0.24s cubic-bezier(0.32,0.72,0,1)",
    } as React.CSSProperties,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
