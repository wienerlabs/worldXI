import { useRef } from "react";
import type { CardTier } from "../lib/cardData";
import "./ultimate-card.css";

/* card outlines — MUST mirror the CSS clip-paths in ultimate-card.css */
const PATH_BASE = "M42 0 L238 0 L280 48 L280 352 L140 400 L0 352 L0 48 Z";
const PATH_SPECIAL = "M34 0 L246 0 L280 32 L280 340 L246 368 L140 400 L34 368 L0 340 L0 32 Z";

/* inline placeholder head/shoulders so a missing photo never shows a broken image */
const PH_PLAYER =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 280'><g fill='rgba(255,255,255,0.42)'><circle cx='110' cy='86' r='50'/><path d='M14 280 C14 196 62 160 110 160 C158 160 206 196 206 280 Z'/></g></svg>"
  );

interface UltimateCardProps {
  name: string;
  tier: CardTier;
  position: string;
  photo?: string;
  flagUrl?: string | null;
  flagEmoji?: string;
  /** Rendered width in px; the 280×400 card scales to fit. */
  width?: number;
}

/**
 * FUT-style collectible card (port of card_1.html) driven by real WorldXI data.
 * Shows photo · name · position · flag · tier only (rating and stat rows removed).
 * Rotating conic frame, holographic special tier, edge comet, pointer 3D tilt.
 */
export function UltimateCard({ name, tier, position, photo, flagUrl, flagEmoji, width = 280 }: UltimateCardProps) {
  const el = useRef<HTMLDivElement>(null);
  const k = width / 280;
  const path = tier === "special" ? PATH_SPECIAL : PATH_BASE;

  const onMove = (e: React.MouseEvent) => {
    const node = el.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    node.style.setProperty("--uc-ry", ((x - 0.5) * 22).toFixed(2) + "deg");
    node.style.setProperty("--uc-rx", ((0.5 - y) * 22).toFixed(2) + "deg");
    node.style.setProperty("--uc-px", (x * 100).toFixed(1) + "%");
    node.style.setProperty("--uc-py", (y * 100).toFixed(1) + "%");
  };
  const onLeave = () => {
    const node = el.current;
    if (!node) return;
    node.style.setProperty("--uc-rx", "0deg");
    node.style.setProperty("--uc-ry", "0deg");
    node.style.setProperty("--uc-px", "50%");
    node.style.setProperty("--uc-py", "50%");
  };

  return (
    <div style={{ width, height: Math.round(width * (400 / 280)), position: "relative", overflow: "visible" }}>
      <div style={{ width: 280, height: 400, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <div className="uc-wrapper" data-tier={tier} aria-label={`${name}, ${position}`} onMouseMove={onMove} onMouseLeave={onLeave}>
          <div className="uc-3d" ref={el}>
            <div className="uc-frame"><div className="uc-face" /></div>

            <div className="uc-photo">
              <img src={photo || PH_PLAYER} alt="" onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = PH_PLAYER; }} />
            </div>

            <div className="uc-shine"><div className="uc-shine-sweep" /><div className="uc-shine-glare" /></div>
            {tier === "special" && (
              <div className="uc-foil"><div className="uc-foil-sheen" /><div className="uc-foil-sparkle" /></div>
            )}

            <div className="uc-top-info">
              <div className="uc-pos">{position}</div>
              <div className="uc-info-div" />
              {flagUrl ? (
                <img className="uc-flag" src={flagUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="uc-flag-emoji">{flagEmoji}</span>
              )}
            </div>

            <div className="uc-name-stats">
              <div className="uc-name">{name}</div>
            </div>

            <svg className="uc-edge" viewBox="0 0 280 400" preserveAspectRatio="none" aria-hidden="true">
              <path className="uc-edge-outline" d={path} pathLength={100} />
              <path className="uc-edge-comet" d={path} pathLength={100} />
              <path className="uc-edge-comet uc-edge-comet-2" d={path} pathLength={100} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
