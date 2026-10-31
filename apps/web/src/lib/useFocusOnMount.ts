import { useEffect, useRef } from 'react';

/**
 * Moves keyboard/screen-reader focus to the returned element when it mounts.
 * Used on every step heading so assistive tech announces the new step
 * (WCAG 2.2 – focus management on route change).
 */
export function useFocusOnMount<T extends HTMLElement>(options: { title?: string } = {}) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (options.title) document.title = `${options.title} | בנק מובאו`;
    ref.current?.focus({ preventScroll: false });
  }, [options.title]);
  return ref;
}
