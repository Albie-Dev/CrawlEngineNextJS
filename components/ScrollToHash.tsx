"use client";

import { useEffect } from "react";

/**
 * Client component that scrolls to an element matching the URL hash on mount.
 * Retries with increasing delays to ensure the target element is rendered.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.replace("#", "");

    function attemptScroll(delay: number) {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (delay < 3000) {
          // Retry with longer delay if element not yet rendered
          attemptScroll(delay + 400);
        }
      }, delay);
    }

    // Start with a short delay after mount, then retry if needed
    attemptScroll(200);
  }, []);

  return null;
}
