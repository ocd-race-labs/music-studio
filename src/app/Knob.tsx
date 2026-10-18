// A rotary knob, as on a desk: drag up or down (or use the arrow keys) to turn it, double-tap to put it back where
// it starts. Steps make it click into place like a stepped switch; frequency knobs turn on a log scale.

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export function Knob({ value, min, max, def, label, display, steps, log, size = 44, disabled, onChange }: {
  value: number;
  min: number;
  max: number;
  /** Where a double-tap puts it back. */
  def: number;
  label: string;
  /** The value as read on screen ("+3 dB", "120 Hz"). */
  display: string;
  steps?: number[];
  log?: boolean;
  size?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const toPos = (v: number) => (log ? Math.log(Math.max(min, v) / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const q = Math.max(0, Math.min(1, p));
    const v = log ? min * Math.pow(max / min, q) : min + q * (max - min);
    return steps ? steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : v;
  };
  const pos = Math.max(0, Math.min(1, toPos(value)));
  const drag = useRef<{ y: number; p: number; id: number } | null>(null);
  const lastTap = useRef(0);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const t = performance.now();
    if (t - lastTap.current < 300) { onChange(def); lastTap.current = 0; return; }
    lastTap.current = t;
    drag.current = { y: e.clientY, p: pos, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const travel = e.shiftKey ? 600 : 160;
    const next = fromPos(d.p + (d.y - e.clientY) / travel);
    if (next !== value) onChange(next);
  };
  const up = () => { drag.current = null; };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const n = steps?.length ?? 100;
    const by = (k: number) => {
      if (steps) {
        const i = steps.reduce((best, s, j) => (Math.abs(s - value) < Math.abs(steps[best] - value) ? j : best), 0);
        return steps[Math.max(0, Math.min(steps.length - 1, i + k))];
      }
      return fromPos(pos + k / n);
    };
    const map: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    if (e.key in map) { e.preventDefault(); onChange(by(map[e.key])); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(min); }
    else if (e.key === 'End') { e.preventDefault(); onChange(max); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(def); }
  };
  const r = size / 2 - 4;
  const c = size / 2;
  const ang = (p: number) => ((-135 + 270 * p) * Math.PI) / 180;
  const pt = (p: number, rr = r) => [c + rr * Math.sin(ang(p)), c - rr * Math.cos(ang(p))];
  const arc = (p0: number, p1: number) => {
    const [x0, y0] = pt(p0); const [x1, y1] = pt(p1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${p1 - p0 > 2 / 3 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const zero = min < 0 && max > 0 && !log ? toPos(0) : 0;
  const [ix, iy] = pt(pos, r - 6);
  return (
    <div className={`knob${disabled ? ' off' : ''}`} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={min} aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100} aria-valuetext={display} aria-disabled={disabled || undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} title={`${label}: ${display}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={arc(0, 1)} className="knob-track" />
        {Math.abs(pos - zero) > 0.002 && <path d={arc(Math.min(pos, zero), Math.max(pos, zero))} className="knob-value" />}
        <circle cx={c} cy={c} r={r - 5} className="knob-cap" />
        <line x1={c} y1={c} x2={ix} y2={iy} className="knob-line" />
      </svg>
      <span className="knob-label">{label}</span>
      <span className="knob-num mono">{display}</span>
    </div>
  );
}
