// Zoom never floats freely: it picks how much of the song fills the screen's width (all of it, 2 bars, 1 bar, half a bar).

export const GAP = 3;
export const DRUM_LABEL = 78;
export const NOTE_LABEL = 76; // room for solfège names like Sol♭4
const MIN_CELL = 12;
const MAX_CELL = 96;

export type Zoom = 'fit' | 'two' | 'bar' | 'half';
export const ZOOMS: Zoom[] = ['fit', 'two', 'bar', 'half'];

export const visibleSteps = (zoom: Zoom, total: number): number =>
  zoom === 'fit' ? total : Math.min(total, zoom === 'two' ? 32 : zoom === 'bar' ? 16 : 8);

/** Width of one step so the chosen span fills the editor. */
export function cellWidth(zoom: Zoom, total: number, width: number, label = DRUM_LABEL): number {
  if (width <= 0) return 30;
  const c = Math.floor((width - label - 2) / visibleSteps(zoom, total) - GAP);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, c));
}

/** First zoom whose steps stay easy to hit: fingers need more room than a mouse. */
export function autoZoom(total: number, width: number, touch: boolean): Zoom {
  const min = touch ? 30 : 18;
  return ZOOMS.find((z) => cellWidth(z, total, width) >= min) ?? 'half';
}
