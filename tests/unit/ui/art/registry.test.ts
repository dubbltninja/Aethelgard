// The art registry (PLAN §9.2 "art registry test"; U73): every glyph the content asks for is drawn, none quietly falls back.
// Items' `art.icon` words reach a glyph of their own (not the type fallback); every status and damage type has its glyph;
// every IconKind is drawn and no two draw the same picture by accident; every creature's sigil spec and every NPC's and
// class's sigil renders; the five rarity frames differ in shape, not only in colour (DESIGN §16.7).
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildContentPack, contentTables } from '@content/index';
import { CLASS_SIGIL_IDS, ClassSigil } from '@ui/art/ClassSigil';
import { CreatureSigil, FAMILY_GLYPHS, SHAPES, SIGIL_ACCENTS } from '@ui/art/CreatureSigil';
import { ICON_KINDS, Icon, damageIcon, isDrawn, statusIcon, strokeFor } from '@ui/art/Icon';
import { ITEM_GLYPH_NAMES, ITEM_ICON_WORDS, ITEM_TYPE_GLYPH, ItemIcon, glyphFor, itemGlyphPaths } from '@ui/art/ItemIcon';
import { NpcSigil, SIGIL_FACTIONS, portraitParts } from '@ui/art/NpcSigil';

const pack = buildContentPack(contentTables);
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const html = (node: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(node);

describe('icons', () => {
  test('every IconKind is drawn, and each draws its own picture', () => {
    const seen = new Map<string, string>();
    for (const kind of ICON_KINDS) {
      expect(isDrawn(kind)).toBe(true);
      const markup = html(Icon({ kind })).replace(/data-icon="[^"]+"/, '');
      expect(markup).not.toContain('NaN');
      expect(markup).toMatch(/<(path|circle|ellipse|rect)/);
      // north/east/south/west are one arrow turned; nothing else may share a drawing
      const twin = seen.get(markup);
      if (twin !== undefined) throw new Error(`${kind} draws the same picture as ${twin}`);
      seen.set(markup, kind);
    }
  });

  test('every status in the content has its own glyph, every damage type too', () => {
    const statuses = Object.keys(pack.statuses);
    expect(statuses.length).toBeGreaterThanOrEqual(19);
    for (const id of statuses) {
      expect(statusIcon(id)).toBe(id as never);
      expect(ICON_KINDS as readonly string[]).toContain(id);
    }
    for (const type of ['physical', 'fire', 'storm', 'ley', 'void', 'chrono']) expect(damageIcon(type)).toBe(`dmg_${type}`);
    // a status the set does not draw says so with the warning triangle, an unknown damage type with the attack glyph
    expect(statusIcon('status_nonsense')).toBe('danger');
    expect(damageIcon('nonsense')).toBe('attack');
  });

  test('status pairs that once read alike now differ (Slow/Haste, Shock/Storm, Rewind/Loop)', () => {
    const drawn = (k: (typeof ICON_KINDS)[number]): string => html(Icon({ kind: k })).replace(/data-icon="[^"]+"/, '');
    expect(drawn('status_slow')).not.toBe(drawn('status_haste'));
    expect(drawn('status_slow')).not.toBe(drawn('wait'));
    expect(drawn('status_shock')).not.toBe(drawn('dmg_storm'));
    expect(drawn('status_rewind')).not.toBe(drawn('loop'));
    // Slow is no hourglass any more: no hourglass family glyph shares its picture
    for (const k of ['status_haste', 'wait', 'hourglass', 'dmg_chrono'] as const) expect(drawn('status_slow')).not.toBe(drawn(k));
  });

  test('small glyphs get a heavier stroke so they stay crisp (1.5 px at 16, 2 px at 24)', () => {
    expect(strokeFor(24)).toBe(2);
    expect(strokeFor(20)).toBe(2);
    expect(strokeFor(16)).toBe(2.25);
    expect(html(Icon({ kind: 'hp', size: 16 }))).toContain('stroke-width="2.25"');
    expect(html(Icon({ kind: 'hp', size: 24 }))).toContain('stroke-width="2"');
  });
});

describe('item icons', () => {
  test('every `art.icon` word in the content picks a glyph of its own, not the type fallback', () => {
    const missing: string[] = [];
    for (const item of Object.values(pack.items)) {
      const glyph = ITEM_ICON_WORDS[item.art.icon];
      if (glyph === undefined) missing.push(`${item.id}: "${item.art.icon}" (${item.type})`);
      else expect(ITEM_GLYPH_NAMES).toContain(glyph);
    }
    expect(missing).toEqual([]);
  });

  test('every glyph is drawn, none draws twice, and every word and type fallback points at one', () => {
    const seen = new Map<string, string>();
    for (const name of ITEM_GLYPH_NAMES) {
      const markup = html(itemGlyphPaths(name));
      expect(markup).not.toContain('NaN');
      expect(markup).toMatch(/<(path|circle|ellipse)/);
      const twin = seen.get(markup);
      if (twin !== undefined) throw new Error(`${name} draws the same picture as ${twin}`);
      seen.set(markup, name);
    }
    for (const glyph of Object.values(ITEM_ICON_WORDS)) expect(ITEM_GLYPH_NAMES).toContain(glyph);
    for (const glyph of Object.values(ITEM_TYPE_GLYPH)) expect(ITEM_GLYPH_NAMES).toContain(glyph);
  });

  test('the words the content used without a glyph (U73) each reach their own', () => {
    const expected: Record<string, string> = {
      clapper: 'bell', coat: 'coat', badge: 'badge', boots: 'boots', brooch: 'moth', circlet: 'circlet', bloom: 'bloom', broth: 'bowl',
      cake: 'cake', ash: 'pile', bronze: 'ingot', crystal: 'crystal', amulet: 'amulet', anchor: 'anchor', book: 'book',
    };
    for (const [word, glyph] of Object.entries(expected)) expect(glyphFor(word, 'material')).toBe(glyph);
    // a word nobody knows still falls back to the type's glyph
    expect(glyphFor('zzz', 'weapon')).toBe('sword');
  });

  test('the five rarity frames differ in pattern, not only in colour (DESIGN §16.7)', () => {
    const shape = (rarity: (typeof RARITIES)[number]): string =>
      html(ItemIcon({ icon: 'sword', type: 'weapon', rarity })).replace(/data-rarity="[^"]+"/, '');
    const frames = RARITIES.map(shape);
    expect(new Set(frames).size).toBe(5);
    expect(RARITIES.length).toBe(5);
    const [common, uncommon, rare, epic, legendary] = frames as [string, string, string, string, string];
    expect(common).not.toContain('stroke-dasharray');
    expect(uncommon).toContain('stroke-dasharray="0.1 4.2"');
    expect(rare).toContain('stroke-dasharray="7 4"');
    expect(epic).toContain('item-icon__frame--inner');
    expect(epic).not.toContain('item-icon__corners');
    expect(legendary).toContain('item-icon__frame--inner');
    expect(legendary).toContain('item-icon__corners');
    // the legendary marks are solid diamonds on all four corners
    expect((legendary.match(/M\d+ -?[\d.]+ L/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('sigils', () => {
  test('every creature sigil spec renders: a known base, a family glyph, a known accent', () => {
    const creatures = Object.values(pack.creatures);
    expect(creatures.length).toBeGreaterThan(60);
    for (const c of creatures) {
      expect(Object.keys(SHAPES), `${c.id} base ${c.sigil.base}`).toContain(c.sigil.base);
      expect(Object.keys(FAMILY_GLYPHS), `${c.id} family ${c.family}`).toContain(c.family);
      if (c.sigil.accent !== undefined) expect(SIGIL_ACCENTS, `${c.id} accent`).toContain(c.sigil.accent);
      for (const state of ['idle', 'ko'] as const) {
        const markup = html(CreatureSigil({ creatureId: c.id, sigil: c.sigil, family: c.family, size: 'sm', state, reducedMotion: true }));
        expect(markup).toContain(`data-creature="${c.id}"`);
        expect(markup).not.toContain('NaN');
      }
    }
  });

  test('every NPC has a portrait sigil that renders and a known faction tint; the same key draws the same face', () => {
    const npcs = Object.values(pack.npcs);
    expect(npcs.length).toBeGreaterThan(30);
    for (const npc of npcs) {
      expect(npc.portrait.sigil).not.toBe('');
      if (npc.portrait.accent !== undefined) expect(SIGIL_FACTIONS, `${npc.id} accent`).toContain(npc.portrait.accent);
      const props = { sigilKey: npc.portrait.sigil, ...(npc.portrait.accent === undefined ? {} : { accent: npc.portrait.accent }) };
      const markup = html(NpcSigil(props));
      expect(markup).toContain(`data-portrait="${npc.portrait.sigil}"`);
      expect(markup).not.toContain('NaN');
      expect(portraitParts(npc.portrait.sigil)).toEqual(portraitParts(npc.portrait.sigil));
    }
    // every NPC that speaks (has a dialogue scene) is among them
    const speakers = new Set(Object.values(pack.dialogues).flatMap((d) => [(d as { npcId?: string }).npcId]).filter((id): id is string => id !== undefined));
    for (const id of speakers) expect(pack.npcs[id], `speaker ${id}`).toBeDefined();
  });

  test('two NPCs rarely share a face: at least 20 distinct portraits among all of them', () => {
    const faces = new Set(Object.values(pack.npcs).map((n) => JSON.stringify(portraitParts(n.portrait.sigil))));
    expect(faces.size).toBeGreaterThanOrEqual(20);
  });

  test('every class has a sigil of its own (not the plain-circle fallback)', () => {
    const fallback = html(ClassSigil({ classId: 'nonsense' }));
    for (const id of Object.keys(pack.classes)) {
      expect(CLASS_SIGIL_IDS).toContain(id);
      expect(html(ClassSigil({ classId: id }))).not.toBe(fallback);
    }
  });
});
