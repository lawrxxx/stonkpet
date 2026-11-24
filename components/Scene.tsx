import type { Wx } from "@/lib/store";

/** Garden scene. The weather is the market. */
export function SceneSvg({ w }: { w: Wx }) {
  const sky = { sun: ["#BFE6FF", "#FFF1D6"], rain: ["#AEB8CC", "#E4E7EE"], night: ["#1B2347", "#34407A"] }[w];
  const hillB = w === "night" ? "#2F5A4C" : "#9BE3B5", hillF = w === "night" ? "#3E7360" : "#7ED6A2";
  const gid = "sky" + w;
  return (
    <svg viewBox="0 0 360 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient></defs>
      <rect width="360" height="330" fill={`url(#${gid})`} />
      {w === "sun" && (<>
        <circle cx="300" cy="62" r="46" fill="#FFE9A8" opacity=".55" /><circle cx="300" cy="62" r="30" fill="#FFD66B" />
        <g fill="#fff" opacity=".95"><ellipse cx="80" cy="70" rx="38" ry="16" /><ellipse cx="108" cy="60" rx="26" ry="16" /><ellipse cx="210" cy="110" rx="28" ry="11" /></g>
      </>)}
      {w === "rain" && (<>
        <g fill="#8E98AE"><ellipse cx="110" cy="64" rx="56" ry="22" /><ellipse cx="150" cy="52" rx="36" ry="22" /><ellipse cx="250" cy="80" rx="50" ry="20" /></g>
        <g stroke="#7FA6D6" strokeWidth="3" strokeLinecap="round" opacity=".8">
          {[60, 90, 120, 150, 180, 210, 240, 270, 300].map((x, i) => <path key={x} d={`M${x} ${100 + (i % 3) * 14}l-6 14`} />)}
        </g>
      </>)}
      {w === "night" && (<>
        {[[40, 40], [90, 90], [150, 30], [200, 70], [250, 26], [320, 110], [60, 130], [180, 120]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#fff" opacity=".85" />)}
        <circle cx="296" cy="64" r="26" fill="#FFF1C2" /><circle cx="308" cy="56" r="24" fill="#2A3463" />
      </>)}
      <ellipse cx="80" cy="300" rx="220" ry="80" fill={hillB} />
      <ellipse cx="300" cy="320" rx="200" ry="90" fill={hillF} />
      {w !== "night" && (
        <g>
          {([[60, 268, "#FF9AB0"], [96, 284, "#FFD66B"], [262, 276, "#FF9AB0"], [300, 262, "#fff"], [320, 286, "#FFD66B"]] as const).map(([x, y, c]) => (
            <g key={`${x}`}><circle cx={x} cy={y} r="6" fill={c} /><circle cx={x} cy={y} r="2.5" fill="#E0A93B" /></g>
          ))}
        </g>
      )}
    </svg>
  );
}
