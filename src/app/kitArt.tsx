// Drum kits and drum machines drawn from what they are, so a shelf of fourteen kits is not fourteen copies of one
// drawing: each kit has its shell colour, its cymbals (a ride, a china when it has one) and its era; a cajón set for
// the unplugged kit; each machine its own panel and pad colours.

import { entryOf } from '../packs/collection';
import { findByKey, rowsOf } from '../packs/core';
import type { Lang } from '../domain/types';

export interface KitLook {
  kind: 'kit';
  shell: [string, string];
  head?: string;
  crashes?: 1 | 2;
  toms: 1 | 2;
  ride: boolean;
  china: boolean;
  brushes?: boolean;
  cajon?: boolean;
  hardware?: string;
  wrap?: string;
  era?: string;
}
export interface MachineLook { kind: 'machine'; panel: [string, string]; pads: [string, string, string]; screen: string; era?: string }
export type Look = KitLook | MachineLook;

const K = (shell: [string, string], more: Partial<KitLook> = {}): KitLook => ({ kind: 'kit', shell, toms: 2, ride: true, china: true, ...more });
const M = (panel: [string, string], pads: [string, string, string], screen: string, era?: string): MachineLook => ({ kind: 'machine', panel, pads, screen, era });

const LOOKS: Record<string, Look> = {
  'drums-pop': K(['#F0509E', '#7A1446'], { toms: 1, ride: false, china: false }),
  'drums-rock': K(['#C23A2C', '#6E1712'], { toms: 1, ride: false, china: false }),
  'drums-jazz': K(['#2E6FD8', '#0F2D63'], { toms: 1, ride: false, china: false, crashes: 2, brushes: true, era: 'JAZZ' }),
  'drums-latin': K(['#000', '#000'], { cajon: true, ride: false, china: false }),
  'drums-rock-studio-60': K(['#9FD6E8', '#3E7C94'], { era: '60s' }),
  'drums-rock-stairwell-70': K(['#E0A060', '#7A4418'], { era: '70s' }),
  'drums-rock-arena-80': K(['#F4F4F6', '#A8ACB4'], { head: '#FFFFFF', crashes: 2, era: '80s' }),
  'drums-rock-grunge-90': K(['#3A3A40', '#0E0E10'], { era: '90s' }),
  'drums-rock-alt-2000': K(['#4FBF7A', '#16502E'], { era: '00s' }),
  'drums-rock-garage': K(['#E8C34A', '#7A5A10'], { era: '00s' }),
  'drums-metal-thrash-80': K(['#2A2A30', '#000000'], { head: '#D8D2C4', crashes: 2, wrap: '#C23A2C', era: '80s' }),
  'drums-metal-modern': K(['#E6E9EE', '#6E747C'], { head: '#2A2A30', crashes: 2, hardware: '#C9CDD3', era: '10s' }),
  'drums-punk-77': K(['#F1ECE2', '#9E968A'], { wrap: '#111111', era: '77' }),
  'drums-punk-pop-90': K(['#A78BFA', '#4A2E9A'], { era: '90s' }),
  'drums-909': M(['#C9CDD3', '#8E949C'], ['#F2661C', '#F2A23C', '#E9E2D4'], '#2A1608', '80s'),
  'drums-boom-bap': M(['#4A4038', '#221C17'], ['#E9E2D4', '#C9B48A', '#8E7A5A'], '#1A2410', '90s'),
  'drums-trap': M(['#26262C', '#0E0E10'], ['#A78BFA', '#F0509E', '#3A3A44'], '#1A0E2A', '10s'),
  'drums-el-house': M(['#D8D2C4', '#9E968A'], ['#F2661C', '#F2C23C', '#E9E2D4'], '#2A1608', '80s'),
  'drums-el-deephouse': M(['#3A2E28', '#1A1411'], ['#F2A23C', '#C96A2C', '#5A4A3A'], '#2A1608', '90s'),
  'drums-el-techno': M(['#2A2A30', '#101013'], ['#E8E8EC', '#7E7E88', '#3A3A44'], '#0E1A22', '90s'),
  'drums-el-edm': M(['#1A1A2E', '#0A0A14'], ['#3BC9F0', '#F0509E', '#A78BFA'], '#0A1A2A', '10s'),
  'drums-el-triphop': M(['#5A4A3A', '#2A2018'], ['#C9B48A', '#8E7A5A', '#E9E2D4'], '#1A2410', '90s'),
  'drums-el-idm': M(['#E9E2D4', '#B8B0A0'], ['#3BC9F0', '#2E6FD8', '#141416'], '#0A1A2A', '00s'),
  'drums-el-dnb': M(['#2E3A2A', '#121A10'], ['#9BE04A', '#E8E8EC', '#3A4A34'], '#101A0A', '90s'),
  'drums-el-jungle': M(['#3A4A2A', '#18200F'], ['#E0C34A', '#9BE04A', '#5A6A3A'], '#101A0A', '90s'),
  'drums-el-dubstep': M(['#1E1E24', '#08080A'], ['#9BE04A', '#3A3A44', '#5A5A66'], '#101A0A', '00s'),
  'drums-el-ambient': M(['#BFD6E0', '#7E98A4'], ['#F4F1FF', '#C9D8E6', '#8EA8B8'], '#0E1A22'),
  'drums-hh-oldschool': M(['#B8B0A0', '#7E766A'], ['#F2661C', '#F2C23C', '#E9E2D4'], '#2A1608', '80s'),
  'drums-hh-boombap': M(['#4A4038', '#221C17'], ['#E9E2D4', '#C9B48A', '#F2661C'], '#1A2410', '90s'),
  'drums-hh-trap': M(['#26262C', '#0E0E10'], ['#F0509E', '#A78BFA', '#3A3A44'], '#1A0E2A', '10s'),
  'drums-hh-lofi': M(['#C9A88A', '#7E6248'], ['#E9E2D4', '#F2C2A2', '#8E6A4A'], '#2A1E12', '10s'),
  'drums-hh-drill': M(['#1A1A1E', '#050506'], ['#3BC9F0', '#E8E8EC', '#2A2A32'], '#0A1A2A', '10s'),
  'drums-hh-westcoast': M(['#2E6FD8', '#0F2D63'], ['#F2C23C', '#E9E2D4', '#9EB8E8'], '#0A1A2A', '90s'),
};

export const lookOf = (key: string): Look | undefined => LOOKS[key.replace('instrument.', '')];

/** What sets a kit apart, in one short line: its era's character, or what it is made of. */
export function kitLine(key: string, lang: Lang): string {
  const e = entryOf(key);
  if (e) return e.era[lang].split(' · ').slice(1).join(' · ') || e.era[lang];
  const look = lookOf(key);
  if (look?.kind === 'kit' && look.cajon) return lang === 'es' ? 'cajón · shaker · pandereta' : 'cajón · shaker · tambourine';
  if (look?.kind === 'kit' && look.brushes) return lang === 'es' ? 'escobillas · 1 tom' : 'brushes · 1 tom';
  const rows = rowsOf(key).map((r) => findByKey(r)?.title[lang]).filter(Boolean) as string[];
  return rows.filter((r) => !/bombo|kick|caja|snare|hi-hat/i.test(r)).slice(0, 3).join(' · ').toLowerCase();
}

/** A kit's drawing, in the same 230 by 170 box as the shelf's generic kit. */
export function KitArt({ id, look, w, h }: { id: string; look: KitLook; w: number; h: number }) {
  const g = `kit-${id}`;
  const [c1, c2] = look.shell;
  const head = look.head ?? '#F1ECE2';
  const hw = look.hardware ?? '#9AA0A6';
  return (
    <svg className="st-art" width={w} height={h} viewBox="0 0 230 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c2} /><stop offset="0.5" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
      </defs>
      {look.cajon ? (
        <>
          <path d="M150 136L150 164" stroke={hw} strokeWidth={2} />
          <rect x={78} y={62} width={74} height={100} rx={5} fill="url(#g-wood)" stroke="#3A1806" strokeWidth={1.5} />
          <circle cx={115} cy={122} r={13} fill="#1A0D05" />
          <rect x={82} y={66} width={66} height={8} fill="#F3D7A2" opacity={0.5} />
          <path d="M40 128C36 116 40 102 50 98C60 102 64 116 60 128Z" fill="#E0B54E" stroke="#8A5E12" />
          <rect x={47} y={128} width={6} height={30} rx={2} fill="#6B3410" />
          <circle cx={186} cy={118} r={24} fill="none" stroke="#6B3410" strokeWidth={7} />
          <circle cx={186} cy={118} r={24} fill="none" stroke="#E0B54E" strokeWidth={2} strokeDasharray="3 7" />
          <path d="M200 40L200 92" stroke={hw} strokeWidth={2.5} />
          <ellipse cx={200} cy={40} rx={26} ry={4.5} fill="url(#g-brass)" />
        </>
      ) : (
        <>
          {cymbals(look).map(({ x, y, r, kind }) => (
            <g key={`${kind}${x}`}>
              <path d={`M${x} ${y}L${x} 150`} stroke={hw} strokeWidth={2.5} />
              {kind === 'china' ? (
                <>
                  <path d={`M${x - r} ${y - 4}Q${x} ${y + 6} ${x + r} ${y - 4}L${x + r - 4} ${y + 1}Q${x} ${y + 9} ${x - r + 4} ${y + 1}Z`} fill="url(#g-brass)" />
                  <ellipse cx={x} cy={y + 1} rx={5} ry={2} fill="#8A5E12" />
                </>
              ) : kind === 'ride' ? (
                <>
                  <ellipse cx={x} cy={y} rx={r + 4} ry={5.5} fill="url(#g-brass)" />
                  <ellipse cx={x} cy={y - 1} rx={7} ry={2.5} fill="#FBE6A0" />
                </>
              ) : <ellipse cx={x} cy={y} rx={r} ry={4.5} fill="url(#g-brass)" />}
            </g>
          ))}
          {(look.toms === 1 ? [98] : [92, 140]).map((x, i) => (
            <g key={x}>
              <path d={`M${x - 17 + i} ${74 - i * 2}h${34 - 2 * i}v22h-${34 - 2 * i}z`} fill={`url(#${g})`} />
              <ellipse cx={x} cy={74 - i * 2} rx={17 - i} ry={5} fill={head} />
            </g>
          ))}
          <circle cx={122} cy={122} r={42} fill={head} stroke={`url(#${g})`} strokeWidth={9} />
          <circle cx={122} cy={122} r={16} fill={look.wrap ?? '#E2D9C8'} />
          <path d="M40 108h40v20H40z" fill={`url(#${g})`} />
          <ellipse cx={60} cy={108} rx={20} ry={5} fill={head} />
          <path d="M60 128L52 160M60 128L68 160" stroke={hw} strokeWidth={2} />
          {look.brushes && (
            <>
              <path d="M44 96L76 70M50 100L80 78" stroke="#C9CDD3" strokeWidth={2.5} />
              <path d="M76 70l10-8M80 78l10-6" stroke="#E8E2D2" strokeWidth={5} strokeLinecap="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

function cymbals(look: KitLook) {
  const places = [{ x: 30, y: 40, r: 26 }, { x: 200, y: 30, r: 30 }, { x: 168, y: 18, r: 22 }, { x: 62, y: 24, r: 20 }];
  const kinds: string[] = Array(look.crashes ?? 1).fill('crash');
  if (look.ride) kinds.push('ride');
  if (look.china) kinds.push('china');
  return kinds.map((kind, i) => ({ ...places[i], kind }));
}

/** A drum machine's drawing, in the shelf's 170 by 130 box: its panel, its screen and its pad colours. */
export function MachineArt({ id, look, w, h }: { id: string; look: MachineLook; w: number; h: number }) {
  const g = `mach-${id}`;
  const [a, b, c] = look.pads;
  const grid = [[a, c, c, b], [c, a, c, c], [b, c, a, c]];
  return (
    <svg className="st-art" width={w} height={h} viewBox="0 0 170 130" aria-hidden="true" focusable="false">
      <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={look.panel[0]} /><stop offset="1" stopColor={look.panel[1]} /></linearGradient></defs>
      <rect x={2} y={4} width={166} height={122} rx={8} fill={`url(#${g})`} stroke="#000" strokeWidth={1} />
      <rect x={12} y={12} width={60} height={18} rx={2} fill={look.screen} />
      <path d="M16 22h20M40 22h8" stroke={a} strokeWidth={3} />
      {[92, 114, 136].map((x) => <circle key={x} cx={x} cy={21} r={7} fill="#C9CDD3" stroke="#00000055" />)}
      <circle cx={156} cy={21} r={5} fill={b} />
      {grid.map((row, r) => row.map((fill, i) => <rect key={`${r}${i}`} x={12 + i * 38} y={40 + r * 22} width={34} height={18} rx={3} fill={fill} />))}
      <path d="M14 112H158" stroke="#00000066" strokeWidth={2} strokeDasharray="6 4" />
    </svg>
  );
}
