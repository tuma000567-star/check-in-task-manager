import { useEffect, useRef } from 'react';

/**
 * Setinterval that always runs the latest callback closure.
 * Pass `delay = null` to pause the interval.
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || delay === undefined) return undefined;
    const tick = () => {
      try {
        savedCallback.current && savedCallback.current();
      } catch (e) {
        // Swallow errors from background ticks
        console.warn('useInterval tick failed:', e);
      }
    };
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
