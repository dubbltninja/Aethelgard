// U14: every worked example in DESIGN §13.3 parses. The literals below are copied verbatim from DESIGN.md
// (keep them byte-identical when DESIGN changes); wrappers (`when:`, `optionalWhen:`, `→ effects`) are split into
// their Condition and Effect parts.
import { describe, expect, test } from 'bun:test';
import { ConditionSchema } from '@schema/condition';
import { EffectSchema, Effects } from '@schema/effect';

const conditions: [string, unknown][] = [];
const effectLists: [string, unknown][] = [];

// 1. Heartstone Destroy (choice effects)
effectLists.push(['1 Heartstone Destroy', [{ setFlag: "flag_heartstone_destroyed" }, { clockWatches: -40 }, { rep: { faction: "ironclad", delta: 20 } }, { rep: { faction: "remnants", delta: -25 } }, { rep: { faction: "weavers", delta: -10 } }, { grantEcho: "echo_heartstone_silence" }, { giveItem: { item: "item_heartstone_fragment_dead", count: 2 } }, { setFlag: "flag_ley_cost_up" }, { setFlag: "flag_breach_born_weakened" }, { questAdvance: { quest: "q_echoing_heartbeat", stage: "done_destroy" } }]]);

// 2. Ilyra believes you (entry rule)
const entryRule = { when: { all: [{ echo: "echo_ilyra_watchword" }, { loop: { min: 2 } }, { not: { flag: "flag_ilyra_told" } }] }, node: "watchword_greeting" };
conditions.push(['2 Ilyra believes you', entryRule.when]);

// 3. Breach-door exit (location exit condition)
conditions.push(['3 Breach-door exit', { all: [{ echo: "echo_litany_verse_1" }, { item: { id: "item_chronos_lens" } }, { loop: { min: 2 } }] }]);

// 4. Sethe's void resonance (choice `when`) → effects
conditions.push(["4 Sethe's void resonance", { all: [{ rep: { faction: "weavers", min: 20 } }, { quest: { id: "q_unlidded_eye", status: "completed" } }, { location: "loc_sanctum_of_threads" }] }]);
effectLists.push(["4 Sethe's void resonance", [{ grantEcho: "echo_void_resonance" }]]);

// 5. Brak stays away (choice)
conditions.push(['5 Brak stays away', { all: [{ echo: "echo_brak_death" }, { quest: { id: "q_blighted_outpost", status: "completed" } }] }]);
effectLists.push(['5 Brak stays away', [{ setFlag: "flag_brak_kept_away" }, { loyalty: { companion: "brak", delta: 5 } }, { rep: { faction: "ironclad", delta: 10 } }]]);

// 6. Corruption dialogue; ending E's availableWhen part
conditions.push(['6 Corruption dialogue', { corruption: { min: 3 } }]);
conditions.push(["6 ending E's availableWhen", { any: [{ not: { corruption: { min: 6 } } }, { flag: "flag_corruption_cleansed" }] }]);

// 7. Apex gate (D-048, exactly)
conditions.push(['7 Apex gate, Loop 1', { counter: { name: "quests_completed", min: 6 } }]);
conditions.push(['7 Apex gate, Loop 2+', { any: [{ counter: { name: "quests_completed", min: 6 } }, { echo: "echo_apex_resonance" }] }]);

// 8. Golem shortcut: encounter optionalWhen + dialogue action effects
const encounter = { optionalWhen: { echo: "echo_stone_hide_origin" } };
conditions.push(['8 Golem shortcut optionalWhen', encounter.optionalWhen]);
effectLists.push(['8 Golem shortcut speak_warder_word', [{ setFlag: "flag_outpost_golems_stilled" }, { questAdvance: { quest: "q_blighted_outpost", stage: "cleared" } }]]);

// 9. Kill objective
conditions.push(['9 Kill objective', { killed: { id: "cr_wildling_brute", count: 1, sinceStage: true } }]);

// 10. Companion-gated camp talk
conditions.push(['10 Companion-gated camp talk', { all: [{ companion: { id: "mireya" } }, { loyalty: { companion: "mireya", min: 25 } }, { day: { min: 5 } }] }]);

// 11. Ending B eligibility (ending_mending, at the Movement III consent)
conditions.push(['11 Ending B eligibility', { all: [{ resolve: { min: 8 } }, { echo: "echo_heartstone_resonance" }, { echo: "echo_litany_complete" }, { echo: "echo_void_resonance" }, { echo: "echo_anchor_mechanic" }, { item: { id: "item_breach_anchor" } }, { counter: { name: "factions_trusted", min: 2 } }, { flag: "flag_conflux_anchored" }, { flag: "flag_cradle_pin_anchored" }] }]);

// 12. Ending E's last stage (q_long_archive)
conditions.push(["12 Ending E's last stage", { all: [{ location: "loc_heartstone_depths" }, { clock: { daysLeft: { max: 1 } } }] }]);

// 13. Silverwood Before; Caelum's third-reset line
conditions.push(['13 Silverwood Before', { all: [{ beforeDay: 2 }, { location: "loc_cistern_gardens" }] }]);
conditions.push(["13 Caelum's third-reset line", { beforeResets: { min: 3 } }]);

// Shapes quoted in the effects table's notes
effectLists.push(['table: the Unraveling Tide', [{ surviveRounds: { rounds: 10 } }]]);
effectLists.push(['table: combat leave', [{ leaveCombat: true }]]);
effectLists.push(['table: D-069.5 dropped clock effects', [{ passWatches: 8 }, { passWatches: 4 }]]);

describe('DESIGN §13.3 worked examples', () => {
  test('there are 13 numbered examples, all represented', () => {
    const numbers = new Set([...conditions, ...effectLists].map(([name]) => name.split(' ')[0]).filter((n) => /^\d+$/.test(n!)));
    expect([...numbers].map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  for (const [name, cond] of conditions) {
    test(`condition parses: ${name}`, () => {
      const r = ConditionSchema.safeParse(cond);
      if (!r.success) throw new Error(r.error.message);
      expect(r.data).toEqual(cond as never);
    });
  }

  for (const [name, list] of effectLists) {
    test(`effects parse: ${name}`, () => {
      const r = Effects.safeParse(list);
      if (!r.success) throw new Error(r.error.message);
      for (const effect of list as unknown[]) expect(EffectSchema.safeParse(effect).success).toBe(true);
    });
  }
});
