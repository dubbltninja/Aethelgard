// The BALANCE.md generator (PLAN §7.9): a batch and its per-pack metrics in, Markdown out. Pure and deterministic apart from the
// header's date. Every pack gets every section, each headed `## <Section> · <pack>`; the Targets section lists every DESIGN §19
// row (1–20) and PLAN §1.2 gate (G1–G6) with its result, value and threshold, and a row the pack cannot measure reads
// "n/a — needs …". Numbers from the fixture packs only prove the harness; BALANCE.md is generated from the real pack.
import type { BatchResult } from './batch';
import { coverageRatios, neverLists } from './coverage';
import { FIGHT_LENGTH_BANDS, type Blocker, type Metrics, type TargetRow } from './metrics';

/** The sections of one pack's report, in order (PLAN §7.9). */
export const SECTIONS = ['Targets', 'Completion', 'Days used', 'Damage share', 'Region curve', 'Bosses', 'Economy', 'Quests', 'Echoes', 'Companions', 'Coverage', 'Blockers', 'Recommendations'] as const;
export type Section = (typeof SECTIONS)[number];

/** The heading of a section for a pack. */
export const heading = (section: Section, pack: string): string => `## ${section} · ${pack}`;

const cell = (s: string | number | null | undefined): string => (s === null || s === undefined ? '—' : String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '));
const pct = (x: number | null): string => (x === null ? '—' : `${Math.round(100 * x)}%`);
const pct1 = (x: number): string => `${(100 * x).toFixed(1)}%`;
const n1 = (x: number | null): string => (x === null ? '—' : Number.isInteger(x) ? String(x) : x.toFixed(1));
const n2 = (x: number | null): string => (x === null ? '—' : x.toFixed(2));
const mmss = (ms: number): string => `${Math.floor(ms / 60000)}m ${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`;

function table(head: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string[] {
  if (rows.length === 0) return ['_None._', ''];
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), ''];
}

/** A row of `#` bars scaled to the largest value (ASCII, so the file reads the same everywhere). */
function bars(rows: readonly { label: string; value: number | null }[], unit: (v: number) => string, width = 32): string[] {
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  const labelWidth = Math.max(0, ...rows.map((r) => r.label.length));
  return rows.map((r) => `${r.label.padEnd(labelWidth)}  ${'#'.repeat(r.value === null || max === 0 ? 0 : Math.max(r.value > 0 ? 1 : 0, Math.round((r.value / max) * width)))} ${r.value === null ? 'n/a' : unit(r.value)}`);
}

const RESULT: Record<TargetRow['status'], string> = { pass: 'PASS', fail: 'FAIL', partial: 'PARTIAL', 'n/a': '' };

function targetsSection(m: Metrics): string[] {
  const rows = m.targets.map((t) => [
    typeof t.row === 'number' ? `#${t.row}` : t.row,
    t.name,
    t.status === 'n/a' ? t.detail : `${RESULT[t.status]}${t.sample === undefined ? '' : ` (thin sample: ${t.sample.n} of ${t.sample.required})`}`,
    t.valueText,
    t.threshold,
    t.status === 'n/a' ? '' : t.detail,
  ]);
  const count = (s: TargetRow['status']): number => m.targets.filter((t) => t.status === s).length;
  return [
    `${count('pass')} pass, ${count('fail')} fail, ${count('partial')} partial, ${count('n/a')} n/a of ${m.targets.length} rows. PARTIAL = every part that could be measured passes; the rest is named in the detail. A thin sample means fewer runs than the spec asks for.`,
    '',
    ...table(['#', 'Target', 'Result', 'Value', 'Threshold', 'Detail'], rows),
  ];
}

function completionSection(m: Metrics): string[] {
  const rows = Object.entries(m.byClassBot).map(([key, x]) => {
    const [classId = '', bot = ''] = key.split(':');
    const endings = Object.entries(x.endings)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([id, c]) => `${id.replace(/^ending_/, '')} ${c}`)
      .join(', ');
    return [classId, bot, x.runs, pct(x.loop1EscapeRate), pct(x.loop1ExpiryRate), pct(x.loop1FallenRate), pct(x.loop1ClosedRate), n1(x.medianDaysLoop1), n1(x.p90Days), n2(x.deaths), pct(x.zeroDeathShare), n1(x.medianLevelAtApex), pct(x.abilityActionShare), pct(x.zeroMpFightShare), endings === '' ? '—' : endings];
  });
  return [
    'Loop 1 outcomes per class and bot. Escape = the Contained Tyrant killed and the portal reached (`closer_escape`); Expiry = the clock ran out; FALLEN = at least one Loop 1 game over (reloaded from the autosave); Closed = Loop 1 reached any closer. Deaths = mean Loop 1 deaths per run, FALLEN screens included.',
    '',
    ...table(['Class', 'Bot', 'Runs', 'Escape', 'Expiry', 'FALLEN', 'Closed', 'Median days', 'p90 days', 'Deaths', 'Zero-death', 'Level at Apex', 'Ability share', '0-MP fights', 'Endings'], rows),
  ];
}

function daysSection(m: Metrics): string[] {
  return table(
    ['Bot', 'Loop', 'Runs', 'Min', 'Median', 'p90', 'Max'],
    m.daysByBotLoop.map((d) => [d.bot, d.loop, d.dist.n, d.dist.min, n1(d.dist.median), d.dist.p90, d.dist.max]),
  );
}

function damageSection(m: Metrics): string[] {
  const out: string[] = ['Share of each class\'s damage by source across all main-suite runs; the top 10 are listed and any source over 35 % is flagged.', ''];
  const classes = Object.keys(m.damageShareByClass);
  if (classes.length === 0) return [...out, '_No damage was dealt._', ''];
  for (const classId of classes) {
    const top = Object.entries(m.damageShareByClass[classId] ?? {}).slice(0, 10);
    out.push(`**${classId}**`, '');
    out.push(...table(['Source', 'Share', 'Flag'], top.map(([source, share]) => [source, pct1(share), share > 0.35 ? '**over 35 %**' : ''])));
  }
  return out;
}

function regionSection(m: Metrics): string[] {
  if (m.regionCurve.length === 0) return ['_No region fought._', ''];
  const label = (r: Metrics['regionCurve'][number]): string => `${r.regionId.replace(/^region_/, '')} (${r.levelBand[0]}–${r.levelBand[1]})`;
  return [
    'Fights of the main suite by region, in level-band order. Median rounds exclude fled fights; the death rate is defeats per fight.',
    '',
    ...table(
      ['Region', 'Band', 'Fights', 'Median rounds', 'Death rate', 'Flee rate', 'Damage taken / round'],
      m.regionCurve.map((r) => [r.regionId, `${r.levelBand[0]}–${r.levelBand[1]}`, r.fights, n1(r.medianRounds), pct(r.deathRate), pct(r.fleeRate), n1(r.avgDamageTakenPerRound)]),
    ),
    'Median rounds by band:',
    '',
    '```',
    ...bars(m.regionCurve.map((r) => ({ label: label(r), value: r.medianRounds })), (v) => `${n1(v)} rounds`),
    '```',
    '',
    'Death rate by band:',
    '',
    '```',
    ...bars(m.regionCurve.map((r) => ({ label: label(r), value: r.deathRate })), pct),
    '```',
    '',
  ];
}

function bossSection(m: Metrics): string[] {
  const rows = Object.entries(m.bossStats).map(([id, b]) => [
    id,
    b.fights,
    pct(b.winRate),
    n1(b.medianRounds),
    Object.entries(b.phaseReached)
      .sort((a, c) => Number(a[0]) - Number(c[0]))
      .map(([phase, count]) => `P${Number(phase) + 1} ${count}`)
      .join(', '),
  ]);
  const out = ['Every boss fight of the main and scenario suites. Phase = the highest boss phase the fight reached.', '', ...table(['Boss', 'Fights', 'Win rate', 'Median rounds', 'Highest phase reached'], rows)];
  out.push('Fight length by band (DESIGN §19 #8) and the pre-Tyrant scenario sims (DESIGN §19 #19, melee and caster; effective HP = damage the party dealt in won fights):', '');
  out.push(...table(['Band', 'Target rounds'], FIGHT_LENGTH_BANDS.map((b) => [b.label, `${b.lo}–${b.hi}`])));
  out.push(
    ...table(
      ['Level', 'Class', 'Companion', 'Bot', 'Runs', 'Won', 'Win rate', 'Median rounds', 'Median damage dealt'],
      m.tyrant.map((c) => [c.level, c.classId, c.companion ? 'yes' : 'solo', c.bot, c.runs, c.wins, pct(c.winRate), n1(c.medianRounds), n1(c.medianDamageDealt)]),
    ),
  );
  return out;
}

function top(record: Readonly<Record<string, number>>, count = 10): [string, number][] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, count);
}

function economySection(m: Metrics): string[] {
  const e = m.economy;
  return [
    `- Median gold at the Contained Tyrant: ${n1(e.medianGoldAtApex)}`,
    `- Median gold at the end of Loop 1: ${n1(e.medianGoldEndOfLoop1)}`,
    '',
    'Most-bought items:',
    '',
    ...table(['Item', 'Purchases'], top(e.purchases)),
    'Crafts by recipe:',
    '',
    ...table(['Recipe', 'Crafts'], top(e.craftsByRecipe)),
    'Upgrades by the rarity reached:',
    '',
    ...table(['Rarity', 'Upgrades'], top(e.upgradesByRarity)),
  ];
}

function questSection(m: Metrics): string[] {
  return table(
    ['Quest', 'Started', 'Completed', 'Failed', 'Median days', 'Completed by'],
    Object.entries(m.quests).map(([id, q]) => [id, q.started, q.completed, q.failed, n1(q.medianDaysToComplete), q.completedByBots.join(', ')]),
  );
}

function echoSection(m: Metrics): string[] {
  return ['Runs of the main suite that gained each Echo, and how many gained it in Loop 1.', '', ...table(['Echo', 'Gained', 'In Loop 1'], Object.entries(m.echoes).map(([id, e]) => [id, e.gained, e.firstLoopGained]))];
}

function companionSection(m: Metrics): string[] {
  return table(
    ['Companion', 'Recruited', 'Knocked out', 'Died', 'Average loyalty'],
    Object.entries(m.companions).map(([id, c]) => [id, c.recruited, c.kos, c.deaths, n1(c.avgLoyalty)]),
  );
}

function coverageSection(m: Metrics): string[] {
  const out = ['The union of every run of the pack, scripted `pathBot` proofs included.', '', ...table(['Kind', 'Reached', 'Of', 'Share'], coverageRatios(m.coverage).map((r) => [`${r.kind === 'dialogueChoices' ? 'dialogue choices' : r.kind} ${r.verb}`, r.covered, r.total, pct1(r.ratio)]))];
  const never = neverLists(m.coverage);
  if (never.length === 0) return [...out, 'Nothing is left unreached.', ''];
  out.push('Never reached (each entry is reached in the next batch or justified here):', '');
  for (const l of never) out.push(`- **${l.label}** (${l.ids.length}): ${l.ids.slice(0, 40).join(', ')}${l.ids.length > 40 ? ` … +${l.ids.length - 40} more` : ''}`);
  out.push('');
  return out;
}

function blockerLines(b: Blocker): string[] {
  const out = [`- **${b.pack} · ${b.bot} · ${b.classId} · seed \`${b.seed}\`**${b.scenario === undefined ? '' : ` · scenario ${b.scenario}`} (${b.suite}, stop: ${b.stopReason}${b.hasTrace ? ', trace kept' : ''})`];
  if (b.proofFailure !== undefined) out.push(`  - ending proof failed: ${b.proofFailure}`);
  for (const e of b.errors.slice(0, 5)) out.push(`  - error at step ${e.step}: ${e.message.replace(/\n/g, ' ')}${e.action === undefined ? '' : ` — ${JSON.stringify(e.action).slice(0, 160)}`}`);
  if (b.errors.length > 5) out.push(`  - … ${b.errors.length - 5} more error(s)`);
  if (b.softLock.detected) {
    out.push(`  - soft-lock at step ${b.softLock.step ?? '?'} (${b.softLock.rule ?? 'unknown'}): ${b.softLock.detail ?? ''}`);
    out.push(`  - last actions: ${(b.softLock.lastActions ?? []).map((a) => a.type).join(' ')}`);
  }
  out.push(`  - reproduce: \`${b.repro}\``);
  return out;
}

/** What a blocker is, for grouping: an engine error, the soft-lock rule that fired, or a failed ending proof. */
const blockerKind = (b: Blocker): string => (b.errors.length > 0 ? 'error' : b.softLock.detected ? (b.softLock.rule ?? 'soft-lock') : 'ending proof');

/** The blockers shown in full per pack; the table above them counts all of them. */
export const BLOCKER_DETAIL_LIMIT = 10;

function blockerSection(batch: BatchResult, pack: string, m: Metrics): string[] {
  const out: string[] = [];
  if (m.blockers.length > 0) {
    const groups = new Map<string, { b: Blocker; count: number }>();
    for (const b of m.blockers) {
      const k = [b.suite, b.bot, b.classId, b.scenario ?? '', blockerKind(b)].join('|');
      const g = groups.get(k);
      if (g === undefined) groups.set(k, { b, count: 1 });
      else g.count += 1;
    }
    out.push('Every entry is a release blocker; the seed reproduces it. Grouped by suite, bot, class, scenario and kind (the first run of each group is the one to replay):', '');
    out.push(...table(['Suite', 'Bot', 'Class', 'Scenario', 'Kind', 'Runs', 'First repro'], [...groups.values()].map(({ b, count }) => [b.suite, b.bot, b.classId, b.scenario, blockerKind(b), count, `\`${b.repro}\``])));
    out.push(`In detail (${Math.min(BLOCKER_DETAIL_LIMIT, m.blockers.length)} of ${m.blockers.length}):`, '');
    for (const b of m.blockers.slice(0, BLOCKER_DETAIL_LIMIT)) out.push(...blockerLines(b));
    out.push('');
  }
  for (const f of batch.failures.filter((x) => x.pack === pack)) out.push(`- **${f.pack} · ${f.suite} · ${f.what}** crashed the job: ${f.message}`);
  const d = batch.determinism[pack];
  for (const x of d?.mismatches ?? []) out.push(`- **determinism mismatch** ${x.pack} · ${x.bot} · ${x.classId} · seed \`${x.seed}\`: run ${x.expected}, re-run ${x.rerun}, replay ${x.replay} — reproduce: \`${x.repro}\``);
  if (out.length === 0) return [`None: ${m.runs} run(s), 0 engine errors, 0 soft-locks, 0 failed ending proofs${d === undefined || batch.config.determinism === 0 ? '' : `, ${d.sampled} sampled run(s) replayed to the same hash`}.`, ''];
  return [...out, ''];
}

/** Hints for the rows that did not pass, and for what the coverage and the damage table flag. */
export function recommendations(batch: BatchResult, pack: string, m: Metrics): string[] {
  const out: string[] = [];
  const row = (id: number | string): TargetRow | undefined => m.targets.find((t) => t.row === id);
  const bad = (id: number | string): boolean => {
    const r = row(id);
    return r !== undefined && r.status === 'fail';
  };
  for (const [classId, shares] of Object.entries(m.damageShareByClass)) {
    for (const [source, share] of Object.entries(shares)) {
      if (share > 0.35 && source !== 'basic' && !source.includes(':')) out.push(`Ability ${source} deals ${pct(share)} of ${classId}'s damage (over 35 %) — reduce its scale or raise its cooldown.`);
      else if (share > 0.35 && source === 'basic') out.push(`Basic attacks deal ${pct(share)} of ${classId}'s damage — its abilities are too costly or too weak to be worth casting.`);
    }
  }
  if (bad(1)) out.push('Escape rate is under 60 % for some class — see Completion: a high Expiry share means the route or the clock is too tight, a high FALLEN share that the Loop 1 fights outscale the class.');
  if (bad(3)) out.push('Difficulty is not monotone across the level bands — see the Region curve: re-tune the creature stats of the band that dips.');
  if (bad(8)) out.push('Fight lengths leave their bands — see Targets #8: scale creature HP (not ATK) to bring the median rounds into range.');
  if (bad(9)) out.push('Loop 1 deaths are off — too many for melee/caster (soften the early bands) or too few for random (the game must punish aimless play).');
  if (bad(12)) out.push('A class is outside its ability-usage band — a share too low means the abilities cost too much for the MP pool, too high means basic attacks are never worth it.');
  if (bad(13)) out.push('Fights end with 0 MP too often — raise MP regen or lower ability costs for the class named in Targets #13.');
  if (bad(14)) out.push('Economy is off — see Targets #14: tune kill gold, the cheapest healing price or the quest rewards.');
  if (bad(15)) out.push('The clock expires too often or too rarely for the explorer — adjust the number of days a full exploration needs, or the Heartstone clock bonus.');
  if (bad(19)) out.push('The Contained Tyrant misses its target — see Bosses: adjust its HP or phase damage until L11 wins ≥ 60 % in 12–18 rounds.');
  if (bad('G1')) out.push('Some bot did not finish its runs — see Blockers.');
  if (bad('G4')) out.push('Content is out of reach of the sims — see Coverage for the punch list; add a pathBot script (scripts/quests.ts) for anything a policy bot cannot do.');
  for (const t of m.targets) {
    if (t.sample !== undefined) out.push(`Row ${typeof t.row === 'number' ? `#${t.row}` : t.row} (${t.name}) rests on ${t.sample.n} run(s); the release batch needs ${t.sample.required} — run it with more seeds.`);
  }
  const skipped = batch.skipped.filter((s) => s.pack === pack);
  if (skipped.length > 0) out.push(`${skipped.length} scenario sim(s) were skipped on this pack (it, or the class, cannot get through them): ${[...new Set(skipped.map((s) => s.reason.replace(/^scenario /, '')))].slice(0, 3).join(' | ')}.`);
  if (m.blockers.length > 0 || batch.failures.some((f) => f.pack === pack)) out.unshift('Fix the Blockers first: a balance number from a run that errored or soft-locked cannot be trusted.');
  return out.length === 0 ? ['No automatic hints: every row that could be measured passes.'] : out.map((l) => `- ${l}`);
}

function header(batch: BatchResult, reports: readonly { pack: string; metrics: Metrics }[]): string[] {
  const c = batch.config;
  const blockers = reports.reduce((t, r) => t + r.metrics.blockers.length, 0) + batch.failures.length + Object.values(batch.determinism).reduce((t, d) => t + d.mismatches.length, 0);
  const lines = [
    '# BALANCE',
    '',
    'Generated by `npm run sim:balance` (`tools/gen-balance.ts`); do not edit. Targets are DESIGN §19 and PLAN §1.2; `n/a — needs …` marks a row the pack cannot measure yet, never a pass.',
    '',
    `- **Date:** ${batch.startedAt}`,
    `- **Git SHA:** ${batch.gitSha}`,
    `- **Content version:** ${batch.contentVersion}`,
    `- **Packs:** ${c.packs.join(', ')}`,
    `- **Batch:** ${c.seeds.length} seed(s) \`${c.seeds[0] ?? ''}\`…, bots ${c.bots.join(', ')}, classes ${c.classes === 'all' ? 'all' : c.classes.join(', ')}, max ${c.maxSteps} steps and ${c.maxLoops} loop(s) per run, ${c.scenarioSeeds} scenario seed(s), determinism sample ${c.determinism}${c.modifiers.length === 0 ? '' : `, modifiers ${c.modifiers.join(', ')}`}`,
    `- **Runs:** ${batch.runs.length} (${batch.runs.filter((r) => r.suite === 'main').length} main, ${batch.runs.filter((r) => r.suite === 'scenario').length} scenario, ${batch.runs.filter((r) => r.suite === 'script').length} script), ${batch.skipped.length} scenario sim(s) skipped`,
    `- **Duration:** ${mmss(batch.durationMs)} on ${batch.workers} worker(s); ${batch.runMicrosPerStep.toFixed(0)} µs per step (bot, legal actions and step) with \`__DEV__\` ${batch.dev ? 'ON (steps are deep-frozen: not a release batch)' : 'off'}`,
    `- **Blockers:** ${blockers}`,
    '',
    '| Pack | Runs | Pass | Fail | Partial | n/a | Blockers |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { pack, metrics } of reports) {
    const n = (s: TargetRow['status']): number => metrics.targets.filter((t) => t.status === s).length;
    lines.push(`| ${cell(pack)} | ${metrics.runs} | ${n('pass')} | ${n('fail')} | ${n('partial')} | ${n('n/a')} | ${metrics.blockers.length + batch.failures.filter((f) => f.pack === pack).length + (batch.determinism[pack]?.mismatches.length ?? 0)} |`);
  }
  lines.push('');
  return lines;
}

/** The whole BALANCE.md. */
export function renderBalance(batch: BatchResult, reports: readonly { pack: string; metrics: Metrics }[]): string {
  const out = header(batch, reports);
  for (const { pack, metrics: m } of reports) {
    const body: Record<Section, string[]> = {
      Targets: targetsSection(m),
      Completion: completionSection(m),
      'Days used': daysSection(m),
      'Damage share': damageSection(m),
      'Region curve': regionSection(m),
      Bosses: bossSection(m),
      Economy: economySection(m),
      Quests: questSection(m),
      Echoes: echoSection(m),
      Companions: companionSection(m),
      Coverage: coverageSection(m),
      Blockers: blockerSection(batch, pack, m),
      Recommendations: recommendations(batch, pack, m),
    };
    for (const section of SECTIONS) out.push(heading(section, pack), '', ...body[section], '');
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
