"use client";

import { useEffect, useState } from "react";

/**
 * Client-only looping countdown against a wall-clock period.
 * `offsetSeconds` shifts the phase so independent widgets don't share the same remaining time.
 */
export function useLoopingCountdown(periodSeconds: number, offsetSeconds = 0): {
  remainingSeconds: number;
  elapsedSeconds: number;
  ready: boolean;
} {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (periodSeconds <= 0) return undefined;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = ((now + offsetSeconds) % periodSeconds + periodSeconds) % periodSeconds;
      setElapsedSeconds(elapsed);
      setRemainingSeconds(periodSeconds - elapsed);
      setReady(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [periodSeconds, offsetSeconds]);

  return { remainingSeconds, elapsedSeconds, ready };
}
