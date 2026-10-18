// Faders work in decibels, like a real mixing desk; the song stores linear gain.

export const FADER_MIN_DB = -48;
export const FADER_MAX_DB = 6;

/** Fader position (dB) for a stored gain; silence sits at the bottom. */
export const dbOfGain = (gain: number): number =>
  gain <= 0.0001 ? FADER_MIN_DB : Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, 20 * Math.log10(gain)));

/** Stored gain for a fader position; the bottom of the fader is silence. */
export const gainOfDb = (db: number): number => (db <= FADER_MIN_DB ? 0 : Math.pow(10, db / 20));

export const dbLabel = (gain: number): string => {
  if (gain <= 0.0001) return '-∞';
  const db = 20 * Math.log10(gain);
  return `${db > 0.05 ? '+' : ''}${db.toFixed(1)}`;
};

export const panLabel = (pan: number): string =>
  Math.abs(pan) < 0.02 ? 'C' : pan < 0 ? `L${Math.round(-pan * 100)}` : `R${Math.round(pan * 100)}`;
