"use client";
import { useGo, type Screen } from "./nav";

/** Back button + 4-step progress, as in the demo's onboarding screens. */
export function Top({ back, step }: { back: Screen; step?: number }) {
  const go = useGo();
  return (
    <div className="top">
      <button className="back" onClick={() => go(back)} aria-label="Back">‹</button>
      {step ? (
        <div className="steps" role="img" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : undefined} />)}
        </div>
      ) : null}
      <span style={{ width: 32 }} />
    </div>
  );
}
