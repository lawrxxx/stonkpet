import { useId } from "react";

export type Mood = "happy" | "idle" | "sad" | "sleep" | "chomp" | "think";
const ink = "#14193A";

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
      return (<>
        <path d="M60 120Q72 104 84 120M116 120Q128 104 140 120" stroke={ink} strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M84 146Q100 162 116 146" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
      </>);
    case "sleep":
      return (<>
        <path d="M60 116Q72 128 84 116M116 116Q128 128 140 116" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="100" cy="150" r="5" fill={ink} />
        <text x="150" y="40" fontFamily="Fredoka" fontWeight="600" fontSize="26" fill="#A3B4FF">z</text>
        <text x="170" y="20" fontFamily="Fredoka" fontWeight="600" fontSize="18" fill="#A3B4FF">z</text>
      </>);
    case "sad":
      return (<>
        <path d="M58 96L84 88M116 88L142 96" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="72" cy="118" rx="11" ry="13" fill={ink} /><ellipse cx="128" cy="118" rx="11" ry="13" fill={ink} />
        <circle cx="68" cy="113" r="4" fill="#fff" /><circle cx="124" cy="113" r="4" fill="#fff" />
        <path d="M86 156Q100 144 114 156" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M164 84C170 94 170 100 164 102 158 100 158 94 164 84Z" fill="#7CC4FF" />
      </>);
    case "chomp":
      return (<>
        <path d="M60 120Q72 104 84 120M116 120Q128 104 140 120" stroke={ink} strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="100" cy="152" rx="20" ry="16" fill={ink} /><ellipse cx="100" cy="160" rx="11" ry="6" fill="#FF8FA6" />
      </>);
    default:
      return (<>
        <ellipse cx="72" cy="116" rx="11" ry="13" fill={ink} /><ellipse cx="128" cy="116" rx="11" ry="13" fill={ink} />
        <circle cx="68" cy="111" r="4" fill="#fff" /><circle cx="124" cy="111" r="4" fill="#fff" />
        <path d="M88 146Q100 154 112 146" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
      </>);
  }
}

const label: Record<Mood, string> = { happy: "happy", idle: "content", sad: "a bit sad", sleep: "asleep", chomp: "eating", think: "thinking" };

export function Pet({ mood, size }: { mood: Mood; size: number }) {
  const id = "g" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 200 220" role="img" aria-label={`Pet, ${label[mood]}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9FF2C6" /><stop offset="1" stopColor="#3FCB8A" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="206" rx="62" ry="8" fill="#0E1530" opacity=".08" />
      <path d="M100 50C100 38 102 30 100 20" stroke="#2BB673" strokeWidth="6" strokeLinecap="round" fill="none" />
      <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3DD68C" transform="rotate(-28 86 22)" />
      <ellipse cx="114" cy="22" rx="15" ry="8" fill="#3DD68C" transform="rotate(28 114 22)" />
      <ellipse cx="100" cy="126" rx="82" ry="78" fill={`url(#${id})`} />
      <ellipse cx="66" cy="84" rx="18" ry="11" fill="#fff" opacity=".4" />
      <ellipse cx="54" cy="142" rx="13" ry="8" fill="#FF8FA6" opacity=".55" />
      <ellipse cx="146" cy="142" rx="13" ry="8" fill="#FF8FA6" opacity=".55" />
      <Face mood={mood} />
      {mood === "think" && (<><circle cx="160" cy="70" r="7" fill="#C9D4FF" /><circle cx="176" cy="48" r="10" fill="#C9D4FF" /></>)}
    </svg>
  );
}
