"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "chip" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={className} onClick={async () => { try { await navigator.clipboard.writeText(text); } catch {} setDone(true); }}>
      {done ? "Copied" : label}
    </button>
  );
}
