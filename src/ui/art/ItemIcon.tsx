// <ItemIcon> (DESIGN §17.4): a 48 × 48 single-stroke glyph in a rarity-patterned frame (Common plain, Uncommon dotted, Rare
// dashed, Epic double, Legendary double with corner marks), a small type badge at the top left, and — for gear — one small
// diamond per affix at the lower right. Numbers never live inside icons. The glyph is chosen by the item's `art.icon` word
// (sword, ring, vial …) through GLYPH_OF; a word this table does not know falls back to the item's type. The frame's
// colour is the rarity token and its pattern says the same thing without colour (DESIGN §16.7). Decorative: the row or
// card beside it carries the name and the rarity in words, so the icon is `aria-hidden` unless it is given a `title`.
import type { ReactNode } from 'react';
import type { Rarity } from '@engine/index';
import type { Item } from '@schema/item';
import { RARITY_PATTERN, type RarityPattern } from '../panels/itemModel';

type Glyph =
  | 'sword'
  | 'dagger'
  | 'axe'
  | 'hammer'
  | 'bow'
  | 'staff'
  | 'focus'
  | 'shield'
  | 'plate'
  | 'cloak'
  | 'ring'
  | 'amulet'
  | 'gem'
  | 'rock'
  | 'leaf'
  | 'pouch'
  | 'cracker'
  | 'vial'
  | 'flask'
  | 'doc'
  | 'book'
  | 'key'
  | 'eye'
  | 'horn'
  | 'feather'
  | 'lantern'
  | 'mask'
  | 'heart'
  | 'stone'
  | 'spool'
  | 'pile'
  | 'nail'
  | 'star';

const GLYPHS: Readonly<Record<Glyph, ReactNode>> = {
  sword: <path d="M20 4 L9.5 14.5 M7 12.5 L11.5 17 M9.5 14.5 L5 19 M17.5 4 L20 4 L20 6.5" />,
  dagger: <path d="M18 6 L10.5 13.5 M8.5 12 L12 15.5 M10.5 13.5 L6.5 17.5" />,
  axe: <path d="M16.5 5 L7 20 M13 6.5 C 16 3, 20.5 5, 20 9.5 C 17.5 8.5, 15.5 9.5, 14.5 11.5 Z" />,
  hammer: <path d="M9 20 L14.5 9 M10.5 5 L19.5 9.5 L17 14 L8 9.5 Z" />,
  bow: <path d="M7 4 C 18 8, 18 16, 7 20 M7 4 L7 20 M7 12 L20 12 M17 9 L20 12 L17 15" />,
  staff: (
    <>
      <path d="M5.5 20.5 L14.5 9.5" />
      <circle cx={17} cy={7} r={3.2} />
      <path d="M17 2 L17 3 M22 7 L21 7 M12 7 L13 7" />
    </>
  ),
  focus: <path d="M17.3 5.2 A 8.5 8.5 0 1 0 20.4 13.2 M12 8.5 L12 15.5" />,
  shield: <path d="M12 3 L19 6 L19 12 C 19 16, 16 19, 12 21 C 8 19, 5 16, 5 12 L5 6 Z M12 7 L12 17" />,
  plate: <path d="M8 4 L4 8 L7 11 L7 20 L17 20 L17 11 L20 8 L16 4 C 14 6.5, 10 6.5, 8 4 Z M12 8 L12 20" />,
  cloak: <path d="M9 4 L15 4 L19.5 20 L4.5 20 Z M9 4 C 10 8.5, 14 8.5, 15 4 M12 9 L12 20" />,
  ring: (
    <>
      <circle cx={12} cy={15} r={5.5} />
      <path d="M12 3.5 L15 7 L12 10 L9 7 Z" />
    </>
  ),
  amulet: <path d="M7 3.5 C 8 10, 16 10, 17 3.5 M12 12 L16 16 L12 21 L8 16 Z" />,
  gem: <path d="M8 4 L16 4 L20 10 L12 21 L4 10 Z M4 10 L20 10 M10 4 L8 10 L12 21 M14 4 L16 10 L12 21" />,
  rock: <path d="M5 17 L7 9 L12 5 L18 8 L20 15 L16 19.5 L8 19.5 Z M7 9 L12 12 L18 8 M12 12 L12 19.5" />,
  leaf: <path d="M5 19 C 5 10, 11 5, 19 5 C 19 13, 14 19, 5 19 Z M5 19 L13 11" />,
  pouch: <path d="M8 6.5 L16 6.5 L18.5 20 L5.5 20 Z M8 6.5 C 9 2.5, 15 2.5, 16 6.5 M9 12.5 L15 12.5" />,
  cracker: <path d="M5 7 L19 7 L19 17 L5 17 Z M9 10.5 L9.01 10.5 M12 13.5 L12.01 13.5 M15 10.5 L15.01 10.5" />,
  vial: <path d="M10 3 L14 3 M10.5 3 L10.5 8 L6 18 C 5.5 20, 7 21, 8.5 21 L15.5 21 C 17 21, 18.5 20, 18 18 L13.5 8 L13.5 3 M8 15 L16 15" />,
  flask: <path d="M8.5 4 L15.5 4 L15.5 8 C 20 10, 20.5 20, 12 20.5 C 3.5 20, 4 10, 8.5 8 Z M8.5 8 L15.5 8" />,
  doc: <path d="M7 3.5 L17 3.5 L17 20.5 L7 20.5 Z M10 8 L14 8 M10 12 L14 12 M10 16 L12.5 16" />,
  book: <path d="M5 4 L5 20 L19 20 L19 4 Z M8 4 L8 20 M11 9 L16 9 M11 13 L15 13" />,
  key: (
    <>
      <circle cx={8} cy={8} r={4} />
      <path d="M11 11 L20 20 M17 17 L19.5 14.5 M14.5 14.5 L16.5 12.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12 C 6 6.5, 18 6.5, 21.5 12 C 18 17.5, 6 17.5, 2.5 12 Z" />
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  horn: <path d="M4 18 C 4 9, 12 5, 20 6 C 17 9, 16 12, 16 15 C 12 14, 8 16, 4 18 Z" />,
  feather: <path d="M19 4 C 10 5, 6 11, 5 20 C 12 19, 18 14, 19 4 Z M5 20 L14 11" />,
  lantern: <path d="M9 3 L15 3 M12 3 L12 5 M8 5 L16 5 L17 18 L7 18 Z M12 8 C 10 10, 10 12, 12 14 C 14 12, 14 10, 12 8 Z M8 18 L8 21 L16 21 L16 18" />,
  mask: <path d="M5 6 C 9 4, 15 4, 19 6 C 19 14, 16 19, 12 20.5 C 8 19, 5 14, 5 6 Z M8 10 L10 10 M14 10 L16 10 M10 15 L14 15" />,
  heart: <path d="M12 20 C 5 15, 3 11, 3 8 C 3 5.5, 5 4, 7.2 4 C 9.2 4, 11 5.4, 12 7.2 C 13 5.4, 14.8 4, 16.8 4 C 19 4, 21 5.5, 21 8 C 21 11, 19 15, 12 20 Z" />,
  stone: <path d="M5 16 L16 5 L19.5 8.5 L8.5 19.5 Z M9 12 L12.5 15.5" />,
  spool: <path d="M7 5 L17 5 M7 19 L17 19 M9 5 L9 19 M15 5 L15 19 M9 9 L15 9 M9 12 L15 12 M9 15 L15 15" />,
  pile: <path d="M4 19 C 8 12, 16 12, 20 19 Z M9 9 L9.01 9 M14 7 L14.01 7 M12 11 L12.01 11" />,
  nail: <path d="M7 5 L17 5 M12 5 L12 19 L10.5 21" />,
  star: <path d="M12 3 L14.6 9 L21 9.6 L16.2 13.8 L17.6 20.2 L12 16.9 L6.4 20.2 L7.8 13.8 L3 9.6 L9.4 9 Z" />,
};

/** `art.icon` word → glyph. Words not listed use the item's type (TYPE_GLYPH). */
const GLYPH_OF: Readonly<Record<string, Glyph>> = {
  sword: 'sword', sabre: 'sword', dagger: 'dagger', axe: 'axe', hammer: 'hammer', maul: 'hammer', bow: 'bow', staff: 'staff', void_focus: 'focus',
  plate: 'plate', mail: 'plate', lamellar: 'plate', harness: 'plate', robe: 'cloak', cloak: 'cloak', vestment: 'cloak', mantle: 'cloak',
  ring: 'ring', charm: 'amulet', talisman: 'amulet', pin: 'amulet', tag: 'amulet', seal: 'amulet', sigil: 'amulet',
  shard: 'gem', fragment: 'gem', glass: 'gem', prism: 'gem', pearl: 'gem', slate: 'gem', heartstone: 'gem',
  ore: 'rock', gland: 'rock', spark: 'rock', resin: 'rock', heartwood: 'rock', hide: 'leaf', root: 'leaf', moss: 'leaf', talon: 'feather',
  feather: 'feather', quill: 'feather', salts: 'pouch', salt: 'pouch', hardtack: 'cracker', vial: 'vial', phial: 'vial', draught: 'vial',
  salve: 'vial', oil: 'vial', ink: 'vial', flask: 'flask', jar: 'flask', pattern: 'doc', schematic: 'doc', page: 'doc', notes: 'doc', scroll: 'doc',
  vellum: 'doc', primer: 'doc', tables: 'doc', tome: 'book', ledger: 'book', tally: 'book', key: 'key', lens: 'eye', mirror: 'eye', eye: 'eye',
  whistle: 'horn', horn: 'horn', lantern: 'lantern', mask: 'mask', heart: 'heart', whetstone: 'stone', thread: 'spool', spindle: 'spool',
  dust: 'pile', rivet: 'nail',
};

const TYPE_GLYPH: Readonly<Record<Item['type'], Glyph>> = {
  weapon: 'sword',
  armor: 'plate',
  trinket: 'amulet',
  consumable: 'vial',
  material: 'rock',
  quest: 'star',
  key: 'key',
  recipe: 'doc',
  tome: 'book',
};

/** The glyph an item shows. */
export function glyphFor(icon: string, type: Item['type']): string {
  return GLYPH_OF[icon] ?? TYPE_GLYPH[type];
}

/** A tiny shape per item type, top left (DESIGN §17.4 "a type badge"). */
const BADGES: Readonly<Record<Item['type'], ReactNode>> = {
  weapon: <path d="M5 11 L11 5 M5 8 L8 11" />,
  armor: <path d="M8 4.5 L11.5 6 L11.5 9 C 11.5 10.5, 10 11.5, 8 12 C 6 11.5, 4.5 10.5, 4.5 9 L4.5 6 Z" />,
  trinket: <circle cx={8} cy={8} r={3} />,
  consumable: <path d="M8 4 C 10 7, 11 8, 11 9.5 A 3 3 0 0 1 5 9.5 C 5 8, 6 7, 8 4 Z" />,
  material: <path d="M8 4.5 L11.5 8 L8 11.5 L4.5 8 Z" />,
  quest: <path d="M5 12 L5 4 M5 4.5 L11 4.5 L9.5 7 L11 9.5 L5 9.5" />,
  key: <path d="M6.5 6.5 A 2 2 0 1 0 6.51 6.5 M8 8 L11.5 11.5" />,
  recipe: <path d="M5 4 L11 4 L11 12 L5 12 Z M7 7 L9 7" />,
  tome: <path d="M4.5 5 L11.5 5 L11.5 11.5 L4.5 11.5 Z M8 5 L8 11.5" />,
};

function Frame({ pattern }: { pattern: RarityPattern }): ReactNode {
  const outer = <rect x={2} y={2} width={44} height={44} rx={7} className="item-icon__frame" />;
  switch (pattern) {
    case 'plain':
      return outer;
    case 'dotted':
      return <rect x={2} y={2} width={44} height={44} rx={7} className="item-icon__frame" strokeDasharray="0.1 4.2" strokeLinecap="round" />;
    case 'dashed':
      return <rect x={2} y={2} width={44} height={44} rx={7} className="item-icon__frame" strokeDasharray="7 4" />;
    case 'double':
      return (
        <>
          {outer}
          <rect x={5.5} y={5.5} width={37} height={37} rx={4} className="item-icon__frame item-icon__frame--inner" />
        </>
      );
    case 'double-marks':
      return (
        <>
          {outer}
          <rect x={5.5} y={5.5} width={37} height={37} rx={4} className="item-icon__frame item-icon__frame--inner" />
          <path className="item-icon__frame item-icon__frame--marks" d="M2 9 L9 2 M39 2 L46 9 M2 39 L9 46 M39 46 L46 39" />
        </>
      );
  }
}

export interface ItemIconProps {
  /** The item's `art.icon` word. */
  icon: string;
  type: Item['type'];
  rarity: Rarity;
  /** Gear only: how many affixes the piece carries (0–2 small diamonds, lower right). */
  affixes?: number;
  /** Quest-major pieces draw a heavier glyph. */
  major?: boolean;
  /** Pixels (default 48). */
  size?: number;
  /** Names the icon (role="img"); leave out when the text beside it names the item. */
  title?: string;
}

export function ItemIcon({ icon, type, rarity, affixes = 0, major = false, size = 48, title }: ItemIconProps): ReactNode {
  const named = title !== undefined && title !== '';
  const glyph = glyphFor(icon, type) as Glyph;
  const gear = type === 'weapon' || type === 'armor' || type === 'trinket';
  return (
    <svg
      className="item-icon"
      data-rarity={gear ? rarity : 'common'}
      data-glyph={glyph}
      data-major={major ? 'true' : undefined}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={named ? 'img' : undefined}
      aria-label={named ? title : undefined}
      aria-hidden={named ? undefined : 'true'}
    >
      <Frame pattern={gear ? RARITY_PATTERN[rarity] : 'plain'} />
      <g className="item-icon__glyph" transform="translate(11 11) scale(1.1)" strokeWidth={major ? 2.6 : 2}>
        {GLYPHS[glyph]}
      </g>
      <g className="item-icon__badge" strokeWidth={1.4} transform="translate(2 2)">
        {BADGES[type]}
      </g>
      {gear && affixes > 0 ? (
        <g className="item-icon__affix" strokeWidth={1.4}>
          {Array.from({ length: Math.min(2, affixes) }, (_, i) => (
            <path key={i} d={`M${37 - i * 7} 33.5 L${40 - i * 7} 37 L${37 - i * 7} 40.5 L${34 - i * 7} 37 Z`} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
