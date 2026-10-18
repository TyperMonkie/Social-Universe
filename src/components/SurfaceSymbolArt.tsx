import type { SurfaceSymbol } from "@/lib/contracts";

const glyphs: Record<SurfaceSymbol["icon"], string> = {
  "rock-horns": "🤘",
  guitar: "🎸",
  camera: "📷",
  ball: "⚽",
  music: "♫",
  book: "📖",
  map: "✦",
  star: "★",
};

/** A compact high-contrast marker whose screen position follows a 3D surface anchor. */
export default function SurfaceSymbolArt({ symbol }: { symbol: SurfaceSymbol }) {
  return (
    <div
      aria-label={`${symbol.label} 图标`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        maxWidth: 148,
        padding: "5px 8px 5px 6px",
        borderRadius: 999,
        border: `1px solid ${symbol.color}`,
        background: "rgba(7, 10, 26, .93)",
        color: symbol.color,
        boxShadow: `0 0 15px ${symbol.color}66, 0 5px 16px rgba(0,0,0,.52)`,
        font: '700 11px/1.1 Inter, "PingFang SC", sans-serif',
        whiteSpace: "nowrap",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1 }}>{glyphs[symbol.icon]}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{symbol.label}</span>
    </div>
  );
}
