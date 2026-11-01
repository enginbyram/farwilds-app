/**
 * Pan & zoom for an SVG by changing its viewBox.
 * view = the square of map units currently visible: top-left (x, y) and width w.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_ZOOM } from "@/config/settings";

export interface View { x: number; y: number; w: number; }

export function usePanZoom(fullWidth: number) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: -fullWidth / 2, y: -fullWidth / 2, w: fullWidth });
  const [pixelWidth, setPixelWidth] = useState(900);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  const reset = useCallback(() => setView({ x: -fullWidth / 2, y: -fullWidth / 2, w: fullWidth }), [fullWidth]);
  useEffect(reset, [reset]);

  /** Zoom by factor f (<1 = in) around map point (cx, cy), or the view centre. */
  const zoomBy = useCallback((f: number, cx?: number, cy?: number) => {
    setView(v => {
      const w = Math.min(Math.max(v.w * f, fullWidth / MAX_ZOOM), fullWidth * 1.5);
      const ox = cx ?? v.x + v.w / 2, oy = cy ?? v.y + v.w / 2;
      return { x: ox - ((ox - v.x) * w) / v.w, y: oy - ((oy - v.y) * w) / v.w, w };
    });
  }, [fullWidth]);

  // Track the SVG's on-screen size (labels need it to stay a fixed pixel size).
  // The visible area is the shorter side, because the viewBox is square.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setPixelWidth(Math.min(r.width, r.height) || 900);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse wheel zoom (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(el, e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest(".node")) return;
    pan.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pan.current) return;
    const k = view.w / pixelWidth;
    const { px, py, vx, vy } = pan.current;
    setView(v => ({ ...v, x: vx - (e.clientX - px) * k, y: vy - (e.clientY - py) * k }));
  };
  const onPointerUp = () => { pan.current = null; setPanning(false); };


  return {
    svgRef, view, panning,
    unitsPerPixel: view.w / pixelWidth,
    zoomBy, reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

function toMap(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
