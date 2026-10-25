// The combat stage's figures (U73a; DESIGN §16.5; docs/ART-2.md §7). Pure: built from the models the Combat screen already
// has (the enemy cards, the companion card) and the player's class, so the stage and the cards always agree — the same
// order, the same target, the same names.
import type { CompanionCardModel, EnemyCardModel } from '../../screens/combatModel';
import type { SigilSpec } from '../../art/CreatureSigil';
import { chooseSprite, type SpriteManifest } from '../../art/spriteManifest';
import { companionSprite, creatureSprite, heroSprite, type ResolvedSprite, type SizeClass } from '../../art/sprites';
import { enemySelectName } from './EnemyCard';

export interface StageFigureModel {
  uid: string;
  side: 'hero' | 'enemy';
  role: 'player' | 'companion' | 'enemy';
  name: string;
  /** An enemy's target button name — its card's ("Target The Chronos Tyrant, level 14, boss"). */
  label: string | null;
  /** The figure's file and effect (null → the sigil). */
  sprite: ResolvedSprite | null;
  size: SizeClass;
  /** Stored width / height of the file it will draw (1 for a sigil). */
  aspect: number;
  alive: boolean;
  selected: boolean;
  boss: boolean;
  /** It has lost HP (the Unlit Lantern's paint cracks). */
  wounded: boolean;
  /** For an enemy's sigil (fallback and corner badge). */
  creature: { id: string; sigil: SigilSpec | undefined; family: string | undefined } | null;
  /** The player's class (its ClassSigil fallback). */
  classId: string | null;
  /** A companion's NpcSigil fallback. */
  npcSigil: { key: string; accent?: string } | null;
}

export interface StageInput {
  classId: string;
  player: { uid: string; name: string; alive: boolean };
  companion: CompanionCardModel | null;
  /** The companion's portrait sigil (npc.portrait), for its fallback. */
  companionSigil?: { key: string; accent?: string } | null;
  enemies: readonly EnemyCardModel[];
}

const aspectOf = (sprite: ResolvedSprite | null, manifest?: SpriteManifest): number => {
  const art = chooseSprite(sprite?.file ?? null, manifest);
  return art === null ? 1 : art.w / art.h;
};

/** Heroes first (the companion, then the player in front), then the enemies in card order. */
export function stageFigures(input: StageInput, manifest?: SpriteManifest): StageFigureModel[] {
  const out: StageFigureModel[] = [];
  const c = input.companion;
  if (c !== null) {
    const sprite = companionSprite(c.companionId);
    out.push({
      uid: c.uid,
      side: 'hero',
      role: 'companion',
      name: c.name,
      label: null,
      sprite,
      size: sprite.size,
      aspect: aspectOf(sprite, manifest),
      alive: !c.ko,
      selected: false,
      boss: false,
      wounded: c.hp < c.hpMax,
      creature: null,
      classId: null,
      npcSigil: input.companionSigil ?? { key: c.companionId },
    });
  }
  const hero = heroSprite(input.classId);
  out.push({
    uid: input.player.uid,
    side: 'hero',
    role: 'player',
    name: input.player.name,
    label: null,
    sprite: hero,
    size: hero.size,
    aspect: aspectOf(hero, manifest),
    alive: input.player.alive,
    selected: false,
    boss: false,
    wounded: false,
    creature: null,
    classId: input.classId,
    npcSigil: null,
  });
  for (const e of input.enemies) {
    const sprite = creatureSprite(e.creatureId, input.classId);
    out.push({
      uid: e.uid,
      side: 'enemy',
      role: 'enemy',
      name: e.name,
      label: enemySelectName(e),
      sprite,
      size: sprite?.size ?? (e.rank === 'Boss' ? 'huge' : 'medium'),
      aspect: aspectOf(sprite, manifest),
      alive: e.alive,
      selected: e.selected,
      boss: e.rank === 'Boss',
      wounded: e.hp < e.hpMax,
      creature: { id: e.creatureId, sigil: e.sigil, family: e.family },
      classId: null,
      npcSigil: null,
    });
  }
  return out;
}
