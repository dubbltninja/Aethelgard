// U73a (docs/ART-2.md §1–2, §7; D-128): the sprite and portrait manifest (names, stored sizes, the inlined size), the fallback
// chain (no file → sigil, failed load → sigil, a portrait's missing size borrows the other), size-class scaling and the stage
// layout for 1–4 enemies with nothing clipped on a desktop or a phone band, the variant registry against every creature in the
// pack, facing, the event-driven motion cues, reduced motion, and the stage's target buttons.
import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameEvent } from '@engine/index';
import { buildContentPack } from '@content/index';
import { Portrait } from '@ui/art/Portrait';
import { Sprite, effectClasses, ghostCount } from '@ui/art/Sprite';
import {
  EMPTY_SPRITE_MANIFEST,
  buildSpriteManifest,
  choosePortrait,
  chooseSprite,
  figureCount,
  figureFailed,
  markFigureFailed,
  resetFigureFailures,
  spriteManifest,
  type SpriteManifest,
} from '@ui/art/spriteManifest';
import { CREATURE_SPRITES, SIZE_PX, companionSprite, creatureFiles, creatureSprite, heroSprite, needsFlip, storedFacing, type SizeClass } from '@ui/art/sprites';
import { STAGE, insideBand, stageLayout, type LayoutFigure } from '@ui/art/stageLayout';
import { BEAT_MS, MAX_BEATS, NO_CUES, cueParity, stageCues } from '@ui/art/stageMotion';
import { CombatStage, DEFAULT_STAGE_SIZE, tetherLines } from '@ui/components/combat/CombatStage';
import { enemySelectName } from '@ui/components/combat/EnemyCard';
import { stageFigures, type StageFigureModel } from '@ui/components/combat/stageModel';
import type { CompanionCardModel, EnemyCardModel } from '@ui/screens/combatModel';
import { SpeakerPortrait } from '@ui/screens/DialogueScreen';
import { imageSize, readSpriteManifest, sizeClassMismatches } from '../../../../tools/build';
import { all, byName, call, expand } from '../tree';

afterEach(() => resetFigureFailures());

const content = buildContentPack();
const FIXTURES = path.resolve(import.meta.dirname, '../../../fixtures/art');

/** A manifest with a few figures at their classes' heights. */
const MANIFEST: SpriteManifest = buildSpriteManifest(
  [
    { name: 'cr_corrupted_shade.webp', width: 224, height: 384 },
    { name: 'cr_wildling_brute.webp', width: 430, height: 512 },
    { name: 'cr_arcane_wisp.webp', width: 230, height: 256 },
    { name: 'cr_chronos_tyrant_contained.webp', width: 640, height: 768 },
    { name: 'cr_void_touched_stalker.webp', width: 300, height: 384 },
    { name: 'cr_hollow_lantern.webp', width: 200, height: 256 },
    { name: 'class_ranger.webp', width: 208, height: 384 },
    { name: 'companion_ilyra.webp', width: 200, height: 384 },
  ],
  ['npc_ilyra.webp', 'npc_ilyra@sm.webp', 'npc_brak.webp', 'npc_nyx@sm.webp'],
);

describe('the manifest', () => {
  test('sprites by file id with their stored sizes; portraits in two sizes, a missing one borrowed; other names ignored', () => {
    const m = buildSpriteManifest(
      [
        { name: 'cr_b.webp', width: 10, height: 20 },
        { name: 'class_ranger.webp', width: 5, height: 384 },
        { name: 'companion_nyx.webp', width: 6, height: 384 },
        { name: 'npc_wrong_place.webp', width: 1, height: 1 },
        { name: 'cr_a.png', width: 1, height: 1 },
        { name: 'cr_zero.webp', width: 0, height: 0 },
        { name: 'cr_a.webp', width: 3, height: 4 },
      ],
      ['npc_a.webp', 'npc_a@sm.webp', 'npc_b@sm.webp', 'npc_c.webp', 'readme.txt', 'cr_x.webp'],
      'base/',
    );
    expect(Object.keys(m.sprites)).toEqual(['class_ranger', 'companion_nyx', 'cr_a', 'cr_b']);
    expect(m.sprites.cr_a).toEqual({ src: 'base/sprites/cr_a.webp', w: 3, h: 4 });
    expect(m.portraits).toEqual({
      npc_a: { lg: 'base/portraits/npc_a.webp', sm: 'base/portraits/npc_a@sm.webp' },
      npc_b: { lg: 'base/portraits/npc_b@sm.webp', sm: 'base/portraits/npc_b@sm.webp' },
      npc_c: { lg: 'base/portraits/npc_c.webp', sm: 'base/portraits/npc_c.webp' },
    });
    expect(figureCount(m)).toBe(7);
    expect(spriteManifest()).toEqual(EMPTY_SPRITE_MANIFEST); // no define under bun test
  });

  test('the whole delivered set inlines small (all 67 sprites and 38 portraits under 2.5 kB gzip)', () => {
    const files = [...creatureFiles(), ...Object.keys(content.classes).map((c) => `class_${c}`), ...Object.keys(content.companions).map((c) => `companion_${c}`)];
    expect(files).toHaveLength(56 + 5 + 6);
    const m = buildSpriteManifest(
      files.map((f) => ({ name: `${f}.webp`, width: 321, height: 384 })),
      Object.keys(content.npcs).flatMap((id) => [`${id}.webp`, `${id}@sm.webp`]),
    );
    expect(figureCount(m)).toBe(67 + 38);
    expect(zlib.gzipSync(JSON.stringify(m)).length).toBeLessThan(2500);
  });

  test('the build reads stored sizes from WebP (lossless, extended, lossy) and PNG headers, and the fixture folder', () => {
    const webpL = fs.readFileSync(path.join(FIXTURES, 'sprites/cr_corrupted_shade.webp'));
    expect(imageSize(webpL)).toEqual({ width: 224, height: 384 });
    const riff = (chunk: string, body: number[]): Uint8Array => {
      const b = new Uint8Array(30 + body.length);
      b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
      b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
      b.set([...chunk].map((c) => c.charCodeAt(0)), 12);
      b.set(body, 20);
      return b;
    };
    // VP8X: canvas width-1 and height-1 as 24-bit little-endian at 24 and 27
    expect(imageSize(riff('VP8X', [0, 0, 0, 0, 0xff, 0x01, 0x00, 0xff, 0x02, 0x00]))).toEqual({ width: 512, height: 768 });
    // VP8 (lossy): the frame tag, the start code, then 14-bit width and height
    expect(imageSize(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0x80, 0x01]))).toEqual({ width: 320, height: 384 });
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    png.set([0, 0, 1, 0, 0, 0, 2, 0], 16);
    expect(imageSize(png)).toEqual({ width: 256, height: 512 });
    expect(imageSize(new Uint8Array(40))).toBeNull();
    const fixtures = readSpriteManifest(FIXTURES);
    expect(fixtures.sprites.cr_chronos_tyrant_contained?.h).toBe(768);
    expect(fixtures.sprites.cr_rootling).toBeUndefined(); // left out on purpose: the e2e shows its sigil
    expect(fixtures.portraits.npc_brak).toEqual({ lg: 'art/portraits/npc_brak.webp', sm: 'art/portraits/npc_brak.webp' });
    expect(sizeClassMismatches(fixtures)).toEqual([]);
    expect(sizeClassMismatches(buildSpriteManifest([{ name: 'cr_rootling.webp', width: 9, height: 300 }, { name: 'cr_nobody.webp', width: 9, height: 256 }], []))).toEqual([
      'cr_nobody: not in the sprite registry',
      'cr_rootling: 300 px, small is 256',
    ]);
    expect(readSpriteManifest(path.join(FIXTURES, 'nowhere'))).toEqual(EMPTY_SPRITE_MANIFEST);
  });
});

describe('the fallback chain', () => {
  test('no file → no art; a failed load is remembered; a portrait borrows its other size, then gives up', () => {
    expect(chooseSprite(null, MANIFEST)).toBeNull();
    expect(chooseSprite('cr_rootling', MANIFEST)).toBeNull();
    const shade = chooseSprite('cr_corrupted_shade', MANIFEST);
    expect(shade?.src).toBe('art/sprites/cr_corrupted_shade.webp');
    markFigureFailed(shade!.src);
    expect(figureFailed(shade!.src)).toBe(true);
    expect(chooseSprite('cr_corrupted_shade', MANIFEST)).toBeNull();
    expect(choosePortrait('npc_ilyra', MANIFEST)).toEqual({ lg: 'art/portraits/npc_ilyra.webp', sm: 'art/portraits/npc_ilyra@sm.webp' });
    markFigureFailed('art/portraits/npc_ilyra@sm.webp');
    expect(choosePortrait('npc_ilyra', MANIFEST)).toEqual({ lg: 'art/portraits/npc_ilyra.webp', sm: 'art/portraits/npc_ilyra.webp' });
    markFigureFailed('art/portraits/npc_ilyra.webp');
    expect(choosePortrait('npc_ilyra', MANIFEST)).toBeNull();
    expect(choosePortrait('npc_nyx', MANIFEST)?.lg).toBe('art/portraits/npc_nyx@sm.webp');
    expect(choosePortrait(null, MANIFEST)).toBeNull();
    expect(choosePortrait('npc_nobody', MANIFEST)).toBeNull();
  });

  test('<Sprite> draws the figure with the sigil ready behind it, or the sigil alone', () => {
    const sigil = <svg className="the-sigil" />;
    const drawn = renderToStaticMarkup(<Sprite file="cr_corrupted_shade" fallback={sigil} manifest={MANIFEST} />);
    expect(drawn).toContain('data-art="sprite"');
    expect(drawn).toContain('src="art/sprites/cr_corrupted_shade.webp"');
    expect(drawn).toContain('width="224"');
    expect(drawn).toContain('sprite__fallback');
    expect(drawn).toContain('the-sigil');
    const missing = renderToStaticMarkup(<Sprite file="cr_rootling" fallback={sigil} manifest={MANIFEST} />);
    expect(missing).toContain('data-art="sigil"');
    expect(missing).not.toContain('<img');
    markFigureFailed('art/sprites/cr_corrupted_shade.webp');
    expect(renderToStaticMarkup(<Sprite file="cr_corrupted_shade" fallback={sigil} manifest={MANIFEST} />)).toContain('data-art="sigil"');
    // the error handler marks the file and flips the host to its sigil in place
    resetFigureFailures();
    const img = expand(<Sprite file="cr_corrupted_shade" fallback={sigil} manifest={MANIFEST} />).find((n) => n.type === 'img')!;
    const attrs: Record<string, string> = {};
    const host = { setAttribute: (k: string, v: string) => (attrs[k] = v) };
    call(img, 'onError', { currentTarget: { closest: () => host } });
    expect(attrs).toEqual({ 'data-failed': 'true', 'data-art': 'sigil' });
    expect(figureFailed('art/sprites/cr_corrupted_shade.webp')).toBe(true);
  });

  test('<Portrait> shows the large or the small file in its frame, or the sigil', () => {
    const lg = renderToStaticMarkup(<Portrait npcId="npc_ilyra" size="lg" accent="remnants" fallback={<i>sigil</i>} manifest={MANIFEST} />);
    expect(lg).toContain('src="art/portraits/npc_ilyra.webp"');
    expect(lg).toContain('data-accent="remnants"');
    expect(lg).toContain('portrait--lg');
    expect(renderToStaticMarkup(<Portrait npcId="npc_ilyra" size="sm" fallback={null} manifest={MANIFEST} />)).toContain('npc_ilyra@sm.webp');
    const none = renderToStaticMarkup(<Portrait npcId="npc_tamsin_reed" size="sm" fallback={<i>sigil</i>} manifest={MANIFEST} />);
    expect(none).toContain('data-art="sigil"');
    expect(none).toContain('<i>sigil</i>');
    // the app's own (empty under bun test) manifest: every speaker still draws its sigil
    const html = renderToStaticMarkup(<SpeakerPortrait speaker={{ kind: 'npc', id: 'npc_ilyra', name: 'Ilyra', role: null, faction: null, portrait: { sigil: 'quill' }, creature: null }} />);
    expect(html).toContain('npc-sigil');
    const tyrant = content.creatures.cr_chronos_tyrant_unveiled!;
    const creature = renderToStaticMarkup(
      <SpeakerPortrait speaker={{ kind: 'creature', id: tyrant.id, name: tyrant.name, role: null, faction: null, portrait: null, creature: { id: tyrant.id, sigil: tyrant.sigil, family: tyrant.family } }} />,
    );
    expect(creature).toContain('creature-sigil');
    expect(creature).toContain('data-art="sigil"');
    const you = renderToStaticMarkup(<SpeakerPortrait speaker={{ kind: 'player', id: 'player', name: 'You', role: 'You', faction: null, portrait: { sigil: 'ranger' }, creature: null }} />);
    expect(you).toContain('data-file="class_ranger"');
  });
});

describe('the variant registry and facing', () => {
  test('every creature in the pack has an entry, and nothing else does', () => {
    expect(Object.keys(CREATURE_SPRITES).sort()).toEqual(Object.keys(content.creatures).sort());
  });

  test('56 creatures have their own file; every variant reuses one of them at the same size class', () => {
    const own = creatureFiles();
    expect(own).toHaveLength(56);
    const counts: Record<SizeClass, number> = { small: 0, medium: 0, large: 0, huge: 0 };
    for (const id of own) counts[CREATURE_SPRITES[id]!.size] += 1;
    expect(counts).toEqual({ small: 10, medium: 23, large: 14, huge: 9 });
    const variants = Object.entries(CREATURE_SPRITES).filter(([, d]) => d.base !== undefined);
    expect(variants).toHaveLength(16);
    for (const [id, def] of variants) {
      expect(own, id).toContain(def.base!);
      expect(CREATURE_SPRITES[def.base!]!.size, id).toBe(def.size);
      expect(def.effect, id).toBeDefined();
      expect(id.startsWith('cr_anomaly_'), id).toBe(true);
    }
    // every regional boss and the Tyrant are huge
    for (const c of Object.values(content.creatures)) if (c.role === 'boss') expect(CREATURE_SPRITES[c.id]!.size, c.id).toBe('huge');
  });

  test('the effects follow the brief', () => {
    const kind = (id: string): string | undefined => CREATURE_SPRITES[id]?.effect?.kind;
    for (const id of ['cr_anomaly_echoed_shade', 'cr_anomaly_doubled_phantom', 'cr_stutter_hound']) expect(kind(id), id).toBe('doubled');
    for (const id of ['cr_anomaly_phase_stalker', 'cr_anomaly_late_mireling']) expect(kind(id), id).toBe('phase');
    for (const id of ['cr_anomaly_flat_chord_weaver', 'cr_anomaly_unfiled_archivist', 'cr_anomaly_early_hound', 'cr_anomaly_still_kite']) expect(kind(id), id).toBe('tint');
    expect(kind('cr_anomaly_split_wisp')).toBe('split');
    expect(kind('cr_anomaly_tethered_stalkers')).toBe('tethered');
    expect(kind('cr_anomaly_unlit_lantern')).toBe('painted');
    expect(creatureSprite('cr_anomaly_rootbound_pack', 'ranger')?.effect).toEqual({ kind: 'doubled', copies: 3 });
    expect(ghostCount({ kind: 'doubled', copies: 3 })).toBe(2);
    expect(ghostCount({ kind: 'split' })).toBe(1);
    expect(ghostCount({ kind: 'tint', tint: 'still' })).toBe(0);
    expect(ghostCount(null)).toBe(0);
    expect(effectClasses({ kind: 'tint', tint: 'early' }, false)).toEqual(['sprite--fx-tint', 'sprite--tint-early']);
    expect(effectClasses({ kind: 'painted' }, true)).toEqual(['sprite--fx-painted', 'sprite--cracked']);
    expect(effectClasses(null, false)).toEqual([]);
    const echoed = renderToStaticMarkup(<Sprite file="cr_corrupted_shade" effect={{ kind: 'doubled', copies: 2 }} fallback={null} manifest={MANIFEST} />);
    expect(echoed.match(/<img/g)).toHaveLength(2);
    expect(echoed).toContain('data-effect="doubled"');
  });

  test('facing: creatures stand facing left as stored; heroes face right; the Wayfinder is the class sprite, mirrored', () => {
    expect(storedFacing('cr_corrupted_shade')).toBe('left');
    expect(storedFacing('class_elf')).toBe('right');
    expect(storedFacing('companion_nyx')).toBe('right');
    expect(creatureSprite('cr_corrupted_shade', 'elf')).toEqual({ file: 'cr_corrupted_shade', size: 'medium', effect: null, flip: false });
    expect(creatureSprite('cr_anomaly_echoed_shade', 'elf')?.file).toBe('cr_corrupted_shade');
    expect(creatureSprite('cr_redundant_wayfinder', 'elf')).toEqual({ file: 'class_elf', size: 'medium', effect: { kind: 'wayfinder' }, flip: true });
    expect(creatureSprite('cr_unknown', 'elf')).toBeNull();
    expect(heroSprite('wizard')).toEqual({ file: 'class_wizard', size: 'medium', effect: null, flip: false });
    expect(companionSprite('brak').flip).toBe(false);
    expect(needsFlip('cr_corrupted_shade', 'right')).toBe(true);
    expect(renderToStaticMarkup(<Sprite file="class_ranger" flip fallback={null} manifest={MANIFEST} />)).toContain('sprite--flip');
  });
});

// ---- the stage ------------------------------------------------------------------------------------------------------------------

const DESKTOP = { width: 1248, height: 290 };
const PHONE = { width: 358, height: 190 };
const ASPECT: Record<SizeClass, number> = { small: 0.9, medium: 0.58, large: 0.84, huge: 0.84 };

function figs(enemies: SizeClass[], heroes = 2): LayoutFigure[] {
  return [
    ...Array.from({ length: heroes }, (_, i) => ({ uid: `h${i}`, side: 'hero' as const, size: 'medium' as SizeClass, aspect: 0.55 })),
    ...enemies.map((size, i) => ({ uid: `e${i}`, side: 'enemy' as const, size, aspect: ASPECT[size] })),
  ];
}

describe('the stage layout', () => {
  test('size classes scale together: huge > large > medium > small; a huge boss fills the band to the floor', () => {
    const l = stageLayout(DESKTOP.width, DESKTOP.height, figs(['small', 'medium', 'large', 'huge'], 1));
    const h = (uid: string): number => l.boxes.find((b) => b.uid === uid)!.h;
    expect(h('e3')).toBeGreaterThan(h('e2'));
    expect(h('e2')).toBeGreaterThan(h('e1'));
    expect(h('e1')).toBeGreaterThan(h('e0'));
    const tyrant = l.boxes.find((b) => b.uid === 'e3')!;
    expect(tyrant.feet).toBe(l.floor);
    expect(tyrant.y).toBeCloseTo(DESKTOP.height * STAGE.top, 0);
    // front-rank heights keep the stored ratio (the small and the large stand a step back here, so compare the front ones)
    expect(h('e3') / h('h0')).toBeCloseTo(SIZE_PX.huge / SIZE_PX.medium, 1);
    // without a huge figure, the tallest present (at least large) sets the scale: a medium fight reads bigger
    const solo = stageLayout(DESKTOP.width, DESKTOP.height, figs(['medium'], 1));
    expect(solo.boxes[1]!.h).toBeCloseTo((solo.floor - DESKTOP.height * STAGE.top) * (SIZE_PX.medium / SIZE_PX.large), 0);
  });

  test('1–4 enemies of any sizes stand inside the band on a desktop and a phone, feet on the floor, in card order', () => {
    const mixes: SizeClass[][] = [['medium'], ['huge'], ['small', 'huge'], ['large', 'large', 'medium'], ['small', 'medium', 'large', 'huge'], ['huge', 'large', 'large', 'large'], ['medium', 'medium', 'medium', 'medium']];
    for (const size of [DESKTOP, PHONE, { width: 600, height: 200 }, { width: 1600, height: 330 }]) {
      for (const mix of mixes) {
        for (const heroes of [1, 2]) {
          const l = stageLayout(size.width, size.height, figs(mix, heroes));
          expect(l.boxes).toHaveLength(mix.length + heroes);
          for (const b of l.boxes) {
            expect(insideBand(b, size.width, size.height), `${JSON.stringify(size)} ${mix.join()} ${JSON.stringify(b)}`).toBe(true);
            expect(b.feet).toBeCloseTo(b.y + b.h, 0);
            expect(b.feet === l.floor || b.back).toBe(true);
          }
          const enemies = l.boxes.filter((b) => b.uid.startsWith('e'));
          for (let i = 1; i < enemies.length; i++) expect(enemies[i]!.x).toBeGreaterThan(enemies[i - 1]!.x);
          const heroBoxes = l.boxes.filter((b) => b.uid.startsWith('h'));
          expect(Math.max(...heroBoxes.map((b) => b.x + b.w))).toBeLessThan(Math.min(...enemies.map((b) => b.x)) + 1);
        }
      }
    }
  });

  test('a crowded phone side overlaps a little before it shrinks; a wide desktop band does not overlap at all', () => {
    const four: SizeClass[] = ['small', 'medium', 'large', 'huge'];
    const phone = stageLayout(PHONE.width, PHONE.height, figs(four)).boxes.filter((b) => b.uid.startsWith('e'));
    const overlaps = phone.slice(1).some((b, i) => b.x < phone[i]!.x + phone[i]!.w);
    expect(overlaps).toBe(true);
    const desk = stageLayout(DESKTOP.width, DESKTOP.height, figs(four)).boxes.filter((b) => b.uid.startsWith('e'));
    for (let i = 1; i < desk.length; i++) expect(desk[i]!.x).toBeGreaterThanOrEqual(desk[i - 1]!.x + desk[i - 1]!.w);
    // three or more: every other one a step back, never the huge one
    expect(desk.map((b) => b.back)).toEqual([false, true, false, false]);
  });
});

const enemy = (over: Partial<EnemyCardModel> & { uid: string; creatureId: string; name: string }): EnemyCardModel => ({
  level: 2,
  rank: null,
  hp: 30,
  hpMax: 30,
  alive: true,
  segments: [],
  phase: null,
  statuses: [],
  resistances: null,
  intent: null,
  next: null,
  sigil: { base: 'teardrop', details: [] },
  family: 'fam_hollowed',
  selected: false,
  targetable: true,
  acting: false,
  ...over,
});

const companion: CompanionCardModel = {
  uid: 'c2',
  companionId: 'ilyra',
  name: 'Ilyra',
  hp: 40,
  hpMax: 40,
  ko: false,
  stance: 'guarded',
  stances: [],
  stanceNote: null,
  signature: null,
  focus: { enabled: false, action: null, label: 'Focus' },
  hold: { enabled: false, action: null },
  statuses: [],
};

function scene(enemies: EnemyCardModel[], withCompanion = true): StageFigureModel[] {
  return stageFigures({ classId: 'ranger', player: { uid: 'c1', name: 'Wren', alive: true }, companion: withCompanion ? companion : null, companionSigil: { key: 'quill', accent: 'remnants' }, enemies }, MANIFEST);
}

describe('the stage figures and their buttons', () => {
  const tyrant = enemy({ uid: 'e1', creatureId: 'cr_chronos_tyrant_contained', name: 'The Chronos Tyrant', level: 14, rank: 'Boss', selected: true });
  const reach = enemy({ uid: 'e2', creatureId: 'cr_tyrants_reach', name: 'Tyrant’s Reach', level: 13, rank: 'Elite' });
  const down = enemy({ uid: 'e3', creatureId: 'cr_rootling', name: 'Rootling', alive: false, hp: 0 });

  test('heroes first (companion behind the player), then the enemies in card order; sizes and aspects from the files', () => {
    const f = scene([tyrant, reach, down]);
    expect(f.map((x) => [x.role, x.uid])).toEqual([['companion', 'c2'], ['player', 'c1'], ['enemy', 'e1'], ['enemy', 'e2'], ['enemy', 'e3']]);
    expect(f[1]!.sprite?.file).toBe('class_ranger');
    expect(f[1]!.aspect).toBeCloseTo(208 / 384, 3);
    expect(f[2]!.size).toBe('huge');
    expect(f[2]!.boss).toBe(true);
    expect(f[4]!.aspect).toBe(1); // no rootling file: the sigil's square
    expect(f[0]!.npcSigil).toEqual({ key: 'quill', accent: 'remnants' });
    expect(scene([tyrant], false).map((x) => x.role)).toEqual(['player', 'enemy']);
    // an unknown creature still stands, as its sigil, sized by its rank
    expect(scene([enemy({ uid: 'x', creatureId: 'cr_new', name: 'New', rank: 'Boss' })])[2]).toMatchObject({ sprite: null, size: 'huge' });
  });

  test('each enemy is a button named like its card, pressed when targeted, out of the Tab order; a click targets it', () => {
    const picked: string[] = [];
    const tree = expand(<CombatStage scene={null} figures={scene([tyrant, reach, down])} size={DESKTOP} cues={NO_CUES} reducedMotion={false} onSelect={(u) => picked.push(u)} manifest={MANIFEST} />);
    const buttons = all(tree, 'button');
    expect(buttons.map((b) => b.props['aria-label'])).toEqual([enemySelectName(tyrant), enemySelectName(reach), enemySelectName(down)]);
    expect(buttons[0]!.props['aria-label']).toBe('Target The Chronos Tyrant, level 14, boss');
    expect(buttons.map((b) => b.props['aria-pressed'])).toEqual([true, false, undefined]);
    expect(buttons.every((b) => b.props.tabIndex === -1)).toBe(true);
    call(byName(tree, 'button', /^Target Tyrant’s Reach/), 'onClick');
    call(byName(tree, 'button', 'Rootling, down'), 'onClick');
    expect(picked).toEqual(['e2']);
    // the target has its ring; the heroes are not buttons
    const html = renderToStaticMarkup(<CombatStage scene={null} figures={scene([tyrant, reach, down])} size={DESKTOP} cues={NO_CUES} reducedMotion={false} onSelect={() => undefined} manifest={MANIFEST} />);
    expect(html.match(/stage-fig__ring/g)).toHaveLength(1);
    expect(html).toContain('data-role="player"');
    expect(html).toContain('data-ko="true"');
    expect(html.match(/stage-fig__badge/g)).toHaveLength(3); // a family badge on every creature
    expect(html).toContain('data-art="sigil"'); // the rootling has no file
    expect(html).toContain('art/sprites/cr_chronos_tyrant_contained.webp');
  });

  test('a variant shows its base file with its effect; tethered pairs get a line; the painted one cracks once wounded', () => {
    const t1 = enemy({ uid: 't1', creatureId: 'cr_anomaly_tethered_stalkers', name: 'Tethered Stalker' });
    const t2 = enemy({ uid: 't2', creatureId: 'cr_anomaly_tethered_stalkers', name: 'Tethered Stalker' });
    const lantern = enemy({ uid: 'l', creatureId: 'cr_anomaly_unlit_lantern', name: 'Unlit Lantern', hp: 10, hpMax: 12 });
    const f = scene([t1, t2, lantern]);
    const html = renderToStaticMarkup(<CombatStage scene={null} figures={f} size={DESKTOP} cues={NO_CUES} reducedMotion={false} onSelect={() => undefined} manifest={MANIFEST} />);
    expect(html).toContain('art/sprites/cr_void_touched_stalker.webp');
    expect(html).toContain('data-effect="tethered"');
    expect(html).toContain('combat-stage__tethers');
    expect(html).toContain('sprite--cracked');
    const boxes = stageLayout(DESKTOP.width, DESKTOP.height, f.map((x) => ({ uid: x.uid, side: x.side, size: x.size, aspect: x.aspect }))).boxes;
    expect(tetherLines(f, boxes)).toHaveLength(1);
    expect(tetherLines(scene([t1]), boxes)).toHaveLength(0);
  });

  test('before the band is measured the stage lays out at a default size', () => {
    expect(DEFAULT_STAGE_SIZE.width).toBeGreaterThan(DEFAULT_STAGE_SIZE.height * STAGE.narrowAspect);
  });
});

describe('motion from the events', () => {
  const ev = (e: GameEvent): GameEvent => e;
  const round: GameEvent[] = [
    ev({ t: 'turnStarted', uid: 'c1', round: 1 }),
    ev({ t: 'attackResolved', sourceUid: 'c1', targetUid: 'e1', hit: true, crit: true }),
    ev({ t: 'damageDealt', sourceUid: 'c1', targetUid: 'e1', amount: 12, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'basic', refId: null }),
    ev({ t: 'turnStarted', uid: 'e1', round: 1 }),
    ev({ t: 'attackResolved', sourceUid: 'e1', targetUid: 'c1', hit: true, crit: false }),
    ev({ t: 'damageDealt', sourceUid: 'e1', targetUid: 'c1', amount: 5, damageType: 'void', mitigated: 0, absorbed: 0, kind: 'intent', refId: null }),
    ev({ t: 'turnStarted', uid: 'e2', round: 1 }),
    ev({ t: 'damageDealt', sourceUid: 'e2', targetUid: 'c1', amount: 3, damageType: 'ley', mitigated: 0, absorbed: 0, kind: 'ability', refId: null }),
    ev({ t: 'statusTicked', targetUid: 'e2', statusId: 'status_bleed', amount: 2 }),
    ev({ t: 'damageDealt', sourceUid: 'e2', targetUid: 'e2', amount: 30, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'status', refId: null }),
    ev({ t: 'combatantDefeated', uid: 'e2', refId: 'cr_rootling' }),
    ev({ t: 'bossPhase', uid: 'e1', phase: 1, text: 'It breaks its bands.' }),
  ];

  test('lunges, hits with their numbers, a KO and a phase flare, each in its beat', () => {
    const cues = stageCues(round, 7);
    expect(cues.nonce).toBe(7);
    expect(cues.byUid.c1).toEqual({
      lunge: 0,
      hits: [
        { amount: 5, crit: false, delay: BEAT_MS + BEAT_MS / 3 },
        { amount: 3, crit: false, delay: 2 * BEAT_MS + BEAT_MS / 3 },
      ],
      ko: null,
      flare: null,
    });
    expect(cues.byUid.e1).toEqual({ lunge: BEAT_MS, hits: [{ amount: 12, crit: true, delay: BEAT_MS / 3 }], ko: null, flare: 2 * BEAT_MS });
    // an ability's blow steps in without an attack roll; a bleed tick does not
    expect(cues.byUid.e2).toEqual({ lunge: 2 * BEAT_MS, hits: [{ amount: 30, crit: false, delay: 2 * BEAT_MS }], ko: 2 * BEAT_MS + BEAT_MS / 2, flare: null });
    expect(stageCues([], 1)).toEqual({ nonce: 1, byUid: {} });
    expect([cueParity(2), cueParity(3)]).toEqual(['a', 'b']);
  });

  test('a long round never waits more than MAX_BEATS beats; empty turns add no wait', () => {
    const many: GameEvent[] = [];
    for (let i = 0; i < 9; i++) {
      many.push({ t: 'turnStarted', uid: `e${i}`, round: 1 }, { t: 'turnStarted', uid: `x${i}`, round: 1 });
      many.push({ t: 'attackResolved', sourceUid: `e${i}`, targetUid: 'c1', hit: false, crit: false });
    }
    const cues = stageCues(many, 1);
    expect(cues.byUid.e0!.lunge).toBe(0);
    expect(cues.byUid.e1!.lunge).toBe(BEAT_MS);
    expect(cues.byUid.e8!.lunge).toBe(MAX_BEATS * BEAT_MS);
  });

  test('the stage draws the cues as classes, delays and floating numbers — and none of it under reduced motion', () => {
    const tyrant = enemy({ uid: 'e1', creatureId: 'cr_chronos_tyrant_contained', name: 'The Chronos Tyrant', rank: 'Boss', selected: true });
    const rootling = enemy({ uid: 'e2', creatureId: 'cr_rootling', name: 'Rootling', alive: false, hp: 0 });
    const f = stageFigures({ classId: 'ranger', player: { uid: 'c1', name: 'Wren', alive: true }, companion: null, enemies: [tyrant, rootling] }, MANIFEST);
    const cues = stageCues(round, 3);
    const moving = renderToStaticMarkup(<CombatStage scene={null} figures={f} size={DESKTOP} cues={cues} reducedMotion={false} onSelect={() => undefined} manifest={MANIFEST} />);
    expect(moving).toContain('data-motion="on"');
    for (const bit of ['stage-fig--lunge-b', 'stage-fig--hit-b', 'stage-fig--fall-b', 'stage-fig--flare-b', 'stage-float--crit', '−12', '−5', '−3', `--hit-delay:${BEAT_MS / 3}ms`]) expect(moving).toContain(bit);
    const still = renderToStaticMarkup(<CombatStage scene={null} figures={f} size={DESKTOP} cues={cues} reducedMotion onSelect={() => undefined} manifest={MANIFEST} />);
    expect(still).toContain('data-motion="off"');
    for (const bit of ['stage-fig--lunge', 'stage-fig--hit', 'stage-fig--fall', 'stage-fig--flare', 'stage-float']) expect(still).not.toContain(bit);
    expect(still).toContain('data-ko="true"'); // the KO still shows, as a still state
  });
});
