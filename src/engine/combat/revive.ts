// Reviving a knocked-out companion (DESIGN §4.9, §12.6; U28's rule, moved here by U34): a leaf module so the `revive`
// item effect (effects.ts — Lanternreed Salts, D-080) and Last Bastion (combat) share it without an import cycle
// (companionAi.ts imports effects.ts). combat/companionAi.ts re-exports it.
import type { StepCtx } from '../ctx';
import { round } from '../util/math';
import { roundHalfUp } from './damage';
import { combatLog } from './turnOrder';

/**
 * Revives the knocked-out companion at `pct` of its max HP (DESIGN §12.6: Last Bastion 40 %, Lanternreed Salts 30 %),
 * in a fight (it stands again, statuses cleared, and takes its turns from the next round) or outside one (the active
 * companion if it is down, else the first one down). False when no one is down.
 */
export function reviveCompanion(ctx: StepCtx, pct: number, source: string): boolean {
  const combat = ctx.s.combat;
  if (combat !== null) {
    const down = combat.party.find((c) => c.kind === 'companion' && !c.alive && !c.fledOrGone);
    if (!down) return false;
    Object.assign(down, { alive: true, hp: Math.max(1, roundHalfUp(down.hpMax * pct)), statuses: [], guarding: false });
    ctx.emit({ t: 'healed', targetUid: down.uid, amount: down.hp, source });
    combatLog(combat, `${down.name} stands up again (${down.hp} HP).`, 'heal');
    return true;
  }
  const { recruited, activeId } = ctx.s.companions;
  const active = activeId === null ? undefined : recruited[activeId];
  const down = active?.ko && !active.dead ? active : Object.values(recruited).find((c) => c.ko && !c.dead);
  if (!down) return false;
  down.ko = false;
  down.hp = Math.max(1, round(down.hpMax * pct));
  ctx.log(`${ctx.content.companions[down.id]?.name ?? down.id} comes round (${down.hp} HP).`, 'event');
  return true;
}
