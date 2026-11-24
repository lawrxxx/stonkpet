"use client";
import { Icon } from "./Icon";
import { useGo, type Screen } from "./nav";

/** Back button with optional 4-step progress (onboarding). */
export function Top({ back, step }: { back: Screen; step?: number }) {
  const go = useGo();
  return (
    <div className="top">
      <button className="icon-btn" onClick={() => go(back)} aria-label="Back"><Icon name="back" size={24} /></button>
      {step ? (
        <div className="steps" role="img" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : undefined} />)}
        </div>
      ) : null}
      <span style={{ width: 44 }} aria-hidden="true" />
    </div>
  );
}
