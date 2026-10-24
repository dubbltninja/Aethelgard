// Merging an imported profile into the current one (DESIGN §14.3): "set-union of Echoes / codex / achievements, max of
// mastery, sum of Resonance capped at the sum of observable sources", with "replace" (the file swapped in whole, settings included) as the second option. Pure, so the
// rules are unit-tested. Settings, modifiers, the profile id and the equipped attunements stay the current profile's:
// importing someone's file must not change how this browser looks or which seed family its loops use.
import type { Profile } from '@engine/index';

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];

const REVEAL_RANK = { none: 0, resist: 1, pattern: 2, all: 3 } as const;

function mergeRecord<T>(a: Readonly<Record<string, T>>, b: Readonly<Record<string, T>>, both: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const mine = out[key];
    out[key] = mine === undefined ? value : both(mine, value);
  }
  return out;
}

/**
 * `incoming` folded into `current`. Echoes, codex, map knowledge, discoveries and endings are set unions; the bestiary and
 * class mastery take the larger counters and the deeper knowledge; an achievement earned in both keeps the earlier one;
 * run history is a union by run id (newest 200 kept); the loop counter and New Game+ count take the larger. Resonance is
 * the sum of both (capped at the sum of what both profiles ever earned), except that the same profile imported back
 * into itself counts once: its larger figures stand.
 */
export function mergeProfiles(current: Profile, incoming: Profile): Profile {
  const sameLineage = current.profileId === incoming.profileId;
  const earned = sameLineage ? Math.max(current.resonanceEarnedTotal, incoming.resonanceEarnedTotal) : current.resonanceEarnedTotal + incoming.resonanceEarnedTotal;
  const balance = sameLineage ? Math.max(current.resonance, incoming.resonance) : current.resonance + incoming.resonance;
  const owned = union(current.attunements.owned, incoming.attunements.owned);
  const runs = new Map(current.runHistory.map((r) => [r.runId, r]));
  for (const r of incoming.runHistory) if (!runs.has(r.runId)) runs.set(r.runId, r);
  const lastDeathLocation = current.lastDeathLocation ?? incoming.lastDeathLocation;
  const merged: Profile = {
    ...current,
    echoes: union(current.echoes, incoming.echoes),
    codexUnlocked: union(current.codexUnlocked, incoming.codexUnlocked),
    bestiary: mergeRecord(current.bestiary, incoming.bestiary, (x, y) => ({
      seen: Math.max(x.seen, y.seen),
      killed: Math.max(x.killed, y.killed),
      spared: Math.max(x.spared, y.spared),
      revealed: REVEAL_RANK[x.revealed] >= REVEAL_RANK[y.revealed] ? x.revealed : y.revealed,
      intentsSeen: union(x.intentsSeen, y.intentsSeen),
    })),
    achievements: mergeRecord(current.achievements, incoming.achievements, (x, y) => (y.loop < x.loop || (y.loop === x.loop && y.day < x.day) ? y : x)),
    resonanceEarnedTotal: earned,
    resonance: Math.min(balance, earned),
    attunements: { owned, equipped: current.attunements.equipped.filter((id) => owned.includes(id)) },
    classMastery: mergeRecord(current.classMastery, incoming.classMastery, (x, y) => ({
      loopsPlayed: Math.max(x.loopsPlayed, y.loopsPlayed),
      mastered: union(x.mastered, y.mastered),
      endings: union(x.endings, y.endings),
      bestLevel: Math.max(x.bestLevel, y.bestLevel),
      bestDays: x.bestDays === null ? y.bestDays : y.bestDays === null ? x.bestDays : Math.min(x.bestDays, y.bestDays),
    })),
    runHistory: [...runs.values()].slice(-200),
    mapKnowledge: union(current.mapKnowledge, incoming.mapKnowledge),
    discoveries: union(current.discoveries, incoming.discoveries),
    endingsReached: union(current.endingsReached, incoming.endingsReached),
    loopCounter: Math.max(current.loopCounter, incoming.loopCounter),
    newGamePlus: Math.max(current.newGamePlus, incoming.newGamePlus),
    lastClassId: current.lastClassId ?? incoming.lastClassId,
  };
  if (lastDeathLocation !== undefined) merged.lastDeathLocation = lastDeathLocation;
  return merged;
}
