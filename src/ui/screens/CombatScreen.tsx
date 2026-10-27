// The Combat screen (PLAN §6.3, DESIGN §4 and §16.5 `screen_combat`): the enemy cards across the top (sigil, HP bar
// segmented at a boss's phases, statuses, resistances once known, the intent chip and the foreseen next one), the turn
// order strip and the round, a banner for a boss's phase change or line, the player panel (HP, the class resource,
// statuses, Guard with its post-Guard numbers, Flee with its odds, Item), the ability bar (Attack and the abilities by
// branch, with costs, cooldowns and why a tile is unavailable), the companion card (stance, Command, orders), the
// communion bar against the Tyrant (Resolve, the question, the answers), and the log with each hit explained. In
// Loop 1 a death outside a Horde stays here as the FALLEN screen (load or title, D-082); every other ending of a fight
// leaves combat mode, and <CombatAftermath/> (App) shows its summary.
//
// Keys (DESIGN §16.4, PLAN §6.6, D-066 #13): 1 attacks the target, 2–9 use the abilities in displayed order (while the
// communion runs, 1–9 are its acts), G guards, F flees, I opens the items, C commands the companion, ← / → change the
// target, Space expands the log; the panel letters need Shift in a fight (the resolver's `panel` group). Tab stays the
// browser's focus key (no focus traps, D-035), so ← / → cycle the target where PLAN says Tab.
//
// Pattern (D-104, D-107): the container gathers hooks, builds the model with combatModel.ts, and renders `CombatView`
// (props only). The container also remembers, per step, each hit's explanation and the last hit on each enemy (events
// are its only source); a target chosen by click, tap or arrows is screen state, never engine state.
//
// U73a (D-128): the stage band at the top (CombatStage: the place's painting, the heroes and the enemies as sprites, the
// event-driven motion, sprite targeting in sync with the cards and ← / →). The cards stay below it for the numbers.
//
// U84a (D-147): the fight is one screen that never scrolls the page. Wide (a fine pointer, 760 px up): the stage across the
// top with any banner floating over it, the cards beside the companion and the log, and the turn's controls as the
// screen's last row — fixed-size tiles and buttons, so nothing above them can push them between turns. Phones and touch
// screens: everything scrolls inside the screen and the controls ride in the pinned dock (U73's phone bar).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { watchNow, type Action, type GameEvent, type GameState, type Stance } from '@engine/index';
import type { Region } from '@schema/region';
import { Icon } from '../art/Icon';
import { RegionPalette } from '../art/RegionPalette';
import { Scene } from '../art/Scene';
import { breachOverlay } from '../art/breachOverlay';
import { NO_CUES, stageCues, type StageCues } from '../art/stageMotion';
import { useBackdrop } from '../art/useBackdrop';
import { Button } from '../components/Button';
import { CALLOUT_SLOT_ID } from '../components/Callouts';
import { DockPortal } from '../components/DockPortal';
import { Modal } from '../components/Modal';
import { Meter } from '../components/StatusBar';
import { AbilityBar, BloodToggle } from '../components/combat/AbilityBar';
import { CombatLog } from '../components/combat/CombatLog';
import { CommunionBar } from '../components/combat/CommunionBar';
import { CombatStage, useStageSize } from '../components/combat/CombatStage';
import { CompanionCard } from '../components/combat/CompanionCard';
import { EnemyCard, type HitFlash } from '../components/combat/EnemyCard';
import { PhoneBar } from '../components/combat/PhoneBar';
import { phoneBarModel } from '../components/combat/phoneBarModel';
import { PlayerPanel } from '../components/combat/PlayerPanel';
import { TurnOrder } from '../components/combat/TurnOrder';
import { stageFigures } from '../components/combat/stageModel';
import type { HotkeyMap } from '../hooks/hotkeys';
import { useHotkeys } from '../hooks/useHotkeys';
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery';
import { useShell } from '../shellContext';
import type { SlotInfo } from '../store/gameStore';
import { useContent, useGame, useGameEvents, useLegal, useProfile, useStore } from '../store/useGame';
import {
  COMBAT_LOG_EXPANDED,
  COMBAT_LOG_LINES,
  abilityTiles,
  allyChoices,
  bannerModel,
  combatItems,
  combatLogLines,
  communionButtons,
  communionModel,
  companionCard,
  cycleTarget,
  effectiveTarget,
  enemyCards,
  explainHits,
  fightTitle,
  fleeModel,
  guardModel,
  playerPanel,
  turnOrder,
  type AbilityTileModel,
  type BannerModel,
  type CombatItemModel,
  type CombatLogLine,
  type CommunionButton,
  type CommunionModel,
  type CompanionCardModel,
  type EnemyCardModel,
  type FleeModel,
  type GuardModel,
  type PlayerPanelModel,
  type TurnEntry,
} from './combatModel';

/** Keep turn controls under the thumb on narrow screens and on touch screens (a phone held sideways, a tablet), where the Abilities sheet keeps each tile's Effects disclosure (U84a). */
const PHONE_QUERY = '(max-width: 759.98px), (pointer: coarse)';

/** Explanations kept for the log (the engine caps the log at 200 lines). */
const EXPLAINED_CAP = 200;

export interface FallenModel {
  /** Saves that can be loaded from here (DESIGN §4.7: Load autosave / Load slot / Title). */
  loads: { slot: SlotInfo['slot']; label: string }[];
  canTitle: boolean;
}

export type CombatMenuId = 'inventory' | 'bestiary' | 'help' | 'settings';

/**
 * U84 (REPORT U79 #8, D-049): the FALLEN words match what the screen offers — with a save to load, the loop is not over
 * yet; with none, it is (the title is the only way on). What was learned stays with you either way.
 */
export function fallenText(fallen: Pick<FallenModel, 'loads'>): string {
  return fallen.loads.length > 0
    ? 'You fall, and the Breach closes over you. Load a save to go back before it, or return to the title. What you learned stays with you.'
    : 'The Breach closes over you. This loop is over; what you learned stays with you.';
}

export interface CombatViewProps {
  title: string;
  regionId: string;
  region?: Pick<Region, 'palette'>;
  round: number;
  turns: readonly TurnEntry[];
  banner: BannerModel | null;
  enemies: readonly EnemyCardModel[];
  hits: Readonly<Record<string, HitFlash>>;
  reducedMotion: boolean;
  player: PlayerPanelModel;
  guard: GuardModel;
  flee: FleeModel;
  itemCount: number;
  canItem: boolean;
  tiles: readonly AbilityTileModel[];
  /** U84: the Blood price toggle (a class with Blood price), or absent. */
  blood?: { on: boolean; onToggle: () => void } | null;
  targetName: string | null;
  companion: CompanionCardModel | null;
  communion: CommunionModel | null;
  communionButtons: readonly CommunionButton[];
  showAbilities: boolean;
  log: readonly CombatLogLine[];
  logExpanded: boolean;
  fallen: FallenModel | null;
  menu: Readonly<Record<CombatMenuId, boolean>>;
  onSelectTarget: (uid: string) => void;
  onTile: (tile: AbilityTileModel) => void;
  onGuard: () => void;
  onFlee: () => void;
  onItems: () => void;
  onStance: (stance: Stance) => void;
  onAct: (action: Action) => void;
  onToggleCommuneView: () => void;
  onToggleLog: () => void;
  onMenu: (id: CombatMenuId) => void;
  onLoad: (slot: SlotInfo['slot']) => void;
  onTitle: () => void;
  logRef?: RefObject<HTMLOListElement | null>;
  /** U73 part B: under 760 px the turn's controls pin to the bottom as a bar, and the abilities open as a sheet. */
  phone?: boolean;
  onAbilities?: () => void;
  /** U73a: the stage band (a <CombatStage/>), shown under the heading; absent in tests that leave it out. */
  stage?: ReactNode;
}

const MENU_LABELS: Readonly<Record<CombatMenuId, string>> = { inventory: 'Inventory', bestiary: 'Bestiary', help: 'Keys', settings: 'Settings' };
const MENU_ICONS = { inventory: 'item', bestiary: 'look', help: 'keys', settings: 'settings' } as const;

export function CombatView(p: CombatViewProps): ReactNode {
  const communing = p.communion?.active === true && !p.showAbilities;
  const phone = p.phone === true && p.fallen === null;
  const pinnedCommunion = phone && communing && p.communion !== null;
  const banner = p.banner === null ? null : (
    <aside className="combat-banner" aria-label="What changed">
      {p.banner.title === null ? null : <p className="combat-banner__title">{p.banner.title}</p>}
      {p.banner.lines.map((line, i) => (
        <p key={`${i}:${line}`} className="combat-banner__line">{line}</p>
      ))}
    </aside>
  );
  // the pinned bar: the turn's actions, or the communion when it is on (DESIGN §4.11 "takes the bar's place")
  const pinned = !phone ? null : (
    <DockPortal>
      {pinnedCommunion && p.communion !== null ? (
        <div className="phone-dock phone-dock--communion">
          <CommunionBar model={p.communion} buttons={p.communionButtons} showingAbilities={p.showAbilities} onAct={p.onAct} onToggleView={p.onToggleCommuneView} />
        </div>
      ) : (
        <div className="phone-dock">
          {/* the player's two bars ride with the bar, so a boss's banner and cards never push them below the fold; the panel keeps the named meters */}
          <div className="phone-vitals" aria-hidden="true">
            <Meter kind="hp" label="HP" value={p.player.hp} max={p.player.hpMax} />
            <Meter kind="mp" label={p.player.resourceName} value={p.player.mp} max={p.player.mpMax} />
          </div>
          <PhoneBar
            model={phoneBarModel(p.tiles)}
            targetName={p.targetName}
            guard={p.guard}
            flee={p.flee}
            itemCount={p.itemCount}
            canItem={p.canItem}
            onAttack={p.onTile}
            onGuard={p.onGuard}
            onFlee={p.onFlee}
            onItems={p.onItems}
            onAbilities={p.onAbilities ?? (() => undefined)}
          />
        </div>
      )}
    </DockPortal>
  );
  const menuNav = (
    <nav className="combat-menu" aria-label="Game menu">
      {(Object.keys(MENU_LABELS) as CombatMenuId[])
        .filter((id) => p.menu[id])
        .map((id) => (
          <Button key={id} onClick={() => p.onMenu(id)} aria-keyshortcuts={id === 'help' ? '?' : undefined}>
            <Icon kind={MENU_ICONS[id]} size={18} />
            {MENU_LABELS[id]}
          </Button>
        ))}
    </nav>
  );
  const logPanel = <CombatLog lines={p.log} expanded={p.logExpanded} onToggle={p.onToggleLog} listRef={p.logRef} />;
  const companion = p.companion === null || p.fallen !== null ? null : <CompanionCard companion={p.companion} onStance={p.onStance} onCommand={p.onAct} />;
  // U84a (D-147): on a wide screen the turn's controls are the screen's last row — a fixed region the fight above can't push
  const controls =
    phone || p.fallen !== null ? null : (
      <div className="combat__controls" data-communing={communing ? 'true' : undefined}>
        <PlayerPanel player={p.player} guard={p.guard} flee={p.flee} itemCount={p.itemCount} canItem={p.canItem} onGuard={p.onGuard} onFlee={p.onFlee} onItems={p.onItems} />
        {p.communion === null ? null : (
          <CommunionBar model={p.communion} buttons={p.communionButtons} showingAbilities={p.showAbilities} onAct={p.onAct} onToggleView={p.onToggleCommuneView} />
        )}
        {communing ? null : (
          <AbilityBar tiles={p.tiles} targetName={p.targetName} onUse={p.onTile} compact extra={p.blood == null ? undefined : <BloodToggle on={p.blood.on} onToggle={p.blood.onToggle} />} />
        )}
      </div>
    );
  // the stage band; a phase change or a boss's line shows over its top edge, so it never pushes the cards or the controls
  const stageBand = (
    <div className="combat__stagewrap" data-toast-anchor="">
      {p.stage ?? null}
      {banner}
    </div>
  );
  return (
    <RegionPalette regionId={p.regionId} region={p.region} className="screen screen--combat">
      <section className={p.stage == null ? 'combat' : 'combat combat--staged'} data-screen="combat" data-layout={phone ? 'phone' : 'wide'} aria-labelledby="combat-heading">
        <header className="combat__head">
          <p className="combat__kicker">Combat</p>
          <h1 id="combat-heading" className="combat__title" tabIndex={-1}>
            {p.title}
          </h1>
          <TurnOrder entries={p.turns} round={p.round} />
          {/* wide: the small game menu rides in the heading row, so the log column keeps its height (U84a) */}
          {phone ? null : menuNav}
        </header>
        <div className="combat__body">
          {/* wide: the stage band runs across the top, over the cards and the log */}
          {phone ? null : stageBand}
          <div className="combat__main" data-scroll-region="combat">
            {phone ? stageBand : null}
            <ul className="combat__enemies" aria-label="Enemies">
              {p.enemies.map((enemy) => (
                <EnemyCard key={enemy.uid} enemy={enemy} reducedMotion={p.reducedMotion} hit={p.hits[enemy.uid] ?? null} onSelect={p.onSelectTarget} />
              ))}
            </ul>
            {p.fallen === null ? null : (
              <section className="fallen" aria-labelledby="fallen-heading">
                <Icon kind="fallen" size={48} className="fallen__icon" />
                <h2 id="fallen-heading" className="fallen__title">
                  FALLEN
                </h2>
                <p className="fallen__text">{fallenText(p.fallen)}</p>
                <div className="button-row">
                  {p.fallen.loads.map((l, i) => (
                    <Button key={String(l.slot)} variant={i === 0 ? 'primary' : 'secondary'} onClick={() => p.onLoad(l.slot)} data-autofocus={i === 0 ? '' : undefined}>
                      {l.label}
                    </Button>
                  ))}
                  {p.fallen.canTitle ? (
                    <Button variant={p.fallen.loads.length === 0 ? 'primary' : 'quiet'} onClick={p.onTitle} data-autofocus={p.fallen.loads.length === 0 ? '' : undefined}>
                      Return to title
                    </Button>
                  ) : null}
                </div>
              </section>
            )}
            {phone && p.fallen === null ? (
              <>
                <PlayerPanel player={p.player} guard={p.guard} flee={p.flee} itemCount={p.itemCount} canItem={p.canItem} onGuard={p.onGuard} onFlee={p.onFlee} onItems={p.onItems} barActions />
                {p.communion === null || pinnedCommunion ? null : (
                  <CommunionBar model={p.communion} buttons={p.communionButtons} showingAbilities={p.showAbilities} onAct={p.onAct} onToggleView={p.onToggleCommuneView} />
                )}
              </>
            ) : null}
            {phone ? companion : null}
            {phone ? menuNav : null}
            {phone ? (
              <aside className="combat__side" aria-label="Combat log">
                {logPanel}
              </aside>
            ) : null}
          </div>
          {phone ? null : (
            <aside className="combat__side" aria-label="Combat log">
              {/* U84a: the hint's reserved place (Callouts renders into it) — the log gives way, the controls never move */}
              <div id={CALLOUT_SLOT_ID} className="callout-slot" />
              {companion}
              {logPanel}
            </aside>
          )}
        </div>
        {controls}
      </section>
      {pinned}
    </RegionPalette>
  );
}

/** The consumables sheet (DESIGN §4.1 `I`): each usable item, with one button per way to use it now. Pure. */
export function ItemSheet({ items, onUse }: { items: readonly CombatItemModel[]; onUse: (action: Action) => void }): ReactNode {
  if (items.length === 0) return <p className="panel-intro">You carry nothing you can use in a fight.</p>;
  return (
    <ul className="item-sheet">
      {items.map((item, i) => (
        <li key={item.uid} className="item-sheet__item">
          <p className="item-sheet__name">
            {item.name}
            {item.qty > 1 ? ` × ${item.qty}` : ''}
          </p>
          {item.description === '' ? null : <p className="item-sheet__desc">{item.description}</p>}
          <ul className="plain-list">
            {item.effects.map((effect) => <li key={effect}>{effect}</li>)}
          </ul>
          <div className="button-row">
            {item.uses.map((use, j) => (
              <Button key={use.label} onClick={() => onUse(use.action)} aria-label={`${use.label}: ${item.name}`} data-autofocus={i === 0 && j === 0 ? '' : undefined}>
                {use.label}
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The last hit each enemy took in one step's events (for the floating number). */
export function hitsOf(events: readonly GameEvent[], after: GameState, nonce: number): Record<string, HitFlash> {
  const out: Record<string, HitFlash> = {};
  let crit = false;
  for (const e of events) {
    if (e.t === 'attackResolved') crit = e.crit;
    if (e.t !== 'damageDealt') continue;
    if (after.combat?.enemies.some((x) => x.uid === e.targetUid) !== true) continue;
    const prev = out[e.targetUid];
    out[e.targetUid] = { amount: (prev?.amount ?? 0) + e.amount, crit: (prev?.crit ?? false) || crit, nonce };
    crit = false;
  }
  return out;
}

export function CombatScreen(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((pr) => pr);
  const legal = useLegal();
  const reducedMotion = useReducedMotion();
  const [chosen, setChosen] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const phone = useMediaQuery(PHONE_QUERY);
  const [allyFor, setAllyFor] = useState<AbilityTileModel | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [bloodOn, setBloodOn] = useState(false);
  const [explained, setExplained] = useState<ReadonlyMap<string, string[]>>(() => new Map());
  const [hits, setHits] = useState<Record<string, HitFlash>>({});
  const [cues, setCues] = useState<StageCues>(NO_CUES);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSize = useStageSize(stageRef);
  const before = useRef<GameState>(state);
  const nonce = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ---- what each step did (explanations, floating numbers) ----
  useGameEvents((events, after) => {
    const from = before.current;
    before.current = after;
    if (after.combat === null) return;
    const ex = explainHits(events, from, after, content);
    if (ex.size > 0) setExplained((m) => new Map([...m, ...ex].slice(-EXPLAINED_CAP)));
    nonce.current += 1;
    setHits(hitsOf(events, after, nonce.current));
    setCues(stageCues(events, nonce.current));
  });

  const combat = state.combat;
  const target = effectiveTarget(combat, chosen);
  const stageLocation = combat === null ? undefined : content.locations[combat.locationId];
  const backdrop = useBackdrop(stageLocation, state.world.heartstone, content.locations);
  const model = useMemo(() => {
    const communion = communionModel(state, content, profile, legal);
    const items = combatItems(state, content, legal, target);
    return {
      title: fightTitle(combat),
      turns: turnOrder(combat),
      banner: bannerModel(combat, content),
      enemies: enemyCards(state, content, profile, legal, target),
      player: playerPanel(state, content),
      guard: guardModel(state, content, profile, legal),
      flee: fleeModel(state, content, legal),
      items,
      tiles: abilityTiles(state, content, legal, target, bloodOn),
      companion: companionCard(state, content, legal, target),
      communion,
      communionButtons: communionButtons(communion),
      log: combatLogLines(combat, logExpanded ? COMBAT_LOG_EXPANDED : COMBAT_LOG_LINES, explained),
    };
  }, [state, content, profile, legal, combat, target, logExpanded, explained, bloodOn]);
  const canBleed = content.classes[state.player.classId]?.resource.bloodPrice !== undefined;

  const dispatch = (action: Action): void => void store.dispatch(action);
  const communing = model.communion?.active === true && !showAbilities;
  const targetName = model.enemies.find((e) => e.uid === target)?.name ?? null;
  const canItem = model.items.length > 0;

  const pressTile = (tile: AbilityTileModel): void => {
    if (!tile.enabled) return;
    const blood = bloodOn && tile.bloodable ? { blood: true } : {}; // U84: the Blood price toggle
    if (tile.kind === 'attack') {
      if (target === null) return;
      setChosen(target);
      dispatch({ type: 'attack', targetUid: target });
      return;
    }
    if (tile.target === 'enemy') {
      if (target === null) return;
      setChosen(target);
      dispatch({ type: 'ability', abilityId: tile.id, targetUid: target, ...blood });
      return;
    }
    if (tile.target === 'ally') {
      const choices = allyChoices(state, legal, tile.id);
      if (choices.length > 1) {
        setAllyFor(tile);
        return;
      }
      dispatch({ ...(choices[0]?.action ?? { type: 'ability', abilityId: tile.id }), ...blood });
      return;
    }
    dispatch({ type: 'ability', abilityId: tile.id, ...blood });
  };
  const guard = (): void => {
    if (model.guard.enabled) dispatch({ type: 'guard' });
  };
  const flee = (): void => {
    if (!model.flee.enabled) return;
    if (!model.flee.leave) {
      // Settings → "Ask before fleeing"
      if (!profile.settings.confirmFlee) {
        dispatch({ type: 'flee' });
        return;
      }
      void shell.confirm(`Flee this fight? You have a ${model.flee.chance}% chance to get away.`, { yes: 'Flee', no: 'Keep fighting' }).then((yes) => {
        if (yes) dispatch({ type: 'flee' });
      });
      return;
    }
    void shell.confirm('Leave the Tyrant? This loop ends here.', { yes: 'Leave' }).then((yes) => {
      if (yes) dispatch({ type: 'flee' });
    });
  };
  const command = (): void => {
    const sig = model.companion?.signature;
    if (sig?.enabled === true && sig.action !== null) dispatch(sig.action);
  };
  const act = (action: Action): void => {
    if (store.isLegal(action)) dispatch(action);
  };
  const selectTarget = (uid: string): void => setChosen(uid);
  const menu = (id: CombatMenuId): void => void shell.openPanel(id);

  // ---- keys ----
  const keys: HotkeyMap = {};
  if (communing) {
    for (const b of model.communionButtons) {
      if (b.key !== null) keys[b.key] = { run: () => act(b.action), label: 'Answer by its number', group: 'action', when: () => b.enabled };
    }
  } else {
    for (const tile of model.tiles) {
      if (tile.key !== null) keys[tile.key] = { run: () => pressTile(tile), label: tile.kind === 'attack' ? 'Attack the target' : 'Use an ability by its number', group: 'action', when: () => tile.enabled };
    }
  }
  keys.g = { run: guard, label: 'Guard', group: 'action', when: () => model.guard.enabled };
  if (canBleed && !communing) keys.b = { run: () => setBloodOn((on) => !on), label: 'Toggle the Blood price', group: 'action' };
  if (model.flee.shown) keys.f = { run: flee, label: model.flee.leave ? 'Leave' : 'Flee', group: 'action', when: () => model.flee.enabled };
  keys.i = { run: () => setItemsOpen(true), label: 'Use an item', group: 'action', when: () => canItem };
  if (model.companion?.signature != null) keys.c = { run: command, label: 'Command the companion', group: 'action', when: () => model.companion?.signature?.enabled === true };
  const standing = model.enemies.filter((e) => e.alive).length;
  keys.arrowleft = { run: () => setChosen(cycleTarget(combat, target, -1)), label: 'Change target', group: 'list', when: () => standing > 1 };
  keys.arrowright = { run: () => setChosen(cycleTarget(combat, target, 1)), label: 'Change target', group: 'list', when: () => standing > 1 };
  keys.space = { run: () => setLogExpanded((on) => !on), label: logExpanded ? 'Shorten the log' : 'Expand the log', group: 'system' };
  useHotkeys(keys, { scope: 'Combat' });

  // ---- focus and scroll ----
  const phase = combat?.phase ?? null;
  useLayoutEffect(() => {
    if (phase === 'defeat') rootRef.current?.querySelector<HTMLElement>('.fallen [data-autofocus]')?.focus();
  }, [phase]);
  const communionActive = model.communion?.active === true;
  useLayoutEffect(() => {
    // the communion takes the bar (DESIGN §4.11): its first act takes focus when it opens or the view switches back
    if (communionActive && !showAbilities && !phone) rootRef.current?.querySelector<HTMLElement>('.communion [data-autofocus]')?.focus();
  }, [communionActive, showAbilities, phone]);
  useEffect(() => {
    // on a phone the bar (or the communion) lives in the dock, which the Shell's new-screen focus does not look in: its first
    // control takes focus once the Shell has run, as Attack / the first answer does on a desktop
    if (!phone) return undefined;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (communionActive && !showAbilities) {
        document.querySelector<HTMLElement>('#dock-slot .communion [data-autofocus]')?.focus({ preventScroll: true });
      } else if (active === null || active === document.body || active.id === 'combat-heading' || active.id === 'main') {
        document.querySelector<HTMLElement>('#dock-slot .phone-bar [data-autofocus]')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [phone, communionActive, showAbilities]);
  useEffect(() => {
    const list = logRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [model.log]);

  if (combat === null || model.player === null) {
    return (
      <section className="screen screen--combat" data-screen="combat" aria-labelledby="combat-heading">
        <h1 id="combat-heading">The fight is over</h1>
        <Button onClick={() => dispatch({ type: 'returnToTitle' })}>Return to title</Button>
      </section>
    );
  }

  const location = stageLocation;
  const regionId = location?.regionId ?? '';
  const you = combat.party.find((c) => c.kind === 'player');
  const companionNpc = model.companion === null ? undefined : content.npcs[content.companions[model.companion.companionId]?.npcId ?? ''];
  const figures = stageFigures({
    classId: state.player.classId,
    player: { uid: you?.uid ?? 'player', name: state.player.name, alive: you?.alive ?? true },
    companion: model.companion,
    companionSigil:
      companionNpc === undefined
        ? null
        : companionNpc.portrait.accent === undefined
          ? { key: companionNpc.portrait.sigil }
          : { key: companionNpc.portrait.sigil, accent: companionNpc.portrait.accent },
    enemies: model.enemies,
  });
  const stage =
    location === undefined ? null : (
      <CombatStage
        scene={
          <Scene
            location={location}
            region={content.regions[regionId]}
            state={{
              horde: state.world.hordeActive,
              heartstone: state.world.heartstone,
              watch: watchNow(state),
              loop: state.meta.loop,
              infected: state.world.infected.includes(location.id),
              breachOverlay: breachOverlay({ clock: state.clock, hordeActive: state.world.hordeActive, infected: state.world.infected.includes(location.id) }),
            }}
            reducedMotion={reducedMotion}
            seed={`${location.id}:combat`}
            backdrop={backdrop}
          />
        }
        figures={figures}
        size={stageSize}
        cues={cues}
        reducedMotion={reducedMotion}
        onSelect={selectTarget}
        bandRef={stageRef}
      />
    );
  const fallen: FallenModel | null =
    combat.phase === 'defeat'
      ? {
          loads: store.shell
            .listSlots()
            .filter((s) => s.status === 'ok')
            .map((s) => ({ slot: s.slot, label: s.slot === 'auto' ? 'Load the autosave' : `Load slot ${s.slot}` })),
          canTitle: store.isLegal({ type: 'returnToTitle' }),
        }
      : null;

  return (
    <div ref={rootRef} className="combat-root">
      <CombatView
        title={model.title}
        regionId={regionId}
        region={content.regions[regionId]}
        round={combat.round}
        turns={model.turns}
        banner={model.banner}
        enemies={model.enemies}
        hits={hits}
        reducedMotion={reducedMotion}
        player={model.player}
        guard={model.guard}
        flee={model.flee}
        itemCount={model.items.length}
        canItem={canItem}
        tiles={model.tiles}
        blood={canBleed ? { on: bloodOn, onToggle: () => setBloodOn((on) => !on) } : null}
        targetName={targetName}
        companion={model.companion}
        communion={model.communion}
        communionButtons={model.communionButtons}
        showAbilities={showAbilities}
        log={model.log}
        logExpanded={logExpanded}
        fallen={fallen}
        menu={{ inventory: shell.canOpen('inventory'), bestiary: shell.canOpen('bestiary'), help: shell.canOpen('help'), settings: shell.canOpen('settings') }}
        onSelectTarget={selectTarget}
        onTile={pressTile}
        onGuard={guard}
        onFlee={flee}
        onItems={() => setItemsOpen(true)}
        onStance={(stance) => act({ type: 'setStance', stance })}
        onAct={act}
        onToggleCommuneView={() => setShowAbilities((on) => !on)}
        onToggleLog={() => setLogExpanded((on) => !on)}
        onMenu={menu}
        onLoad={(slot) => {
          const result = store.shell.load(slot);
          if (!result.ok) store.notify(result.error, 'error');
        }}
        onTitle={() => dispatch({ type: 'returnToTitle' })}
        logRef={logRef}
        stage={stage}
        phone={phone}
        onAbilities={() => setAbilitiesOpen(true)}
      />
      {abilitiesOpen && phone ? (
        <Modal title="Abilities" onClose={() => setAbilitiesOpen(false)} className="ability-sheet">
          <AbilityBar
            tiles={model.tiles.filter((t) => t.kind !== 'attack')}
            targetName={targetName}
            extra={canBleed ? <BloodToggle on={bloodOn} onToggle={() => setBloodOn((on) => !on)} /> : undefined}
            onUse={(tile) => {
              setAbilitiesOpen(false);
              pressTile(tile);
            }}
          />
        </Modal>
      ) : null}
      {itemsOpen ? (
        <Modal title="Use an item" onClose={() => setItemsOpen(false)} className="item-sheet-dialog">
          <ItemSheet
            items={model.items}
            onUse={(action) => {
              setItemsOpen(false);
              act(action);
            }}
          />
        </Modal>
      ) : null}
      {allyFor === null ? null : (
        <Modal title={`${allyFor.name}: on whom?`} onClose={() => setAllyFor(null)} className="ally-picker">
          <div className="button-row">
            {allyChoices(state, legal, allyFor.id).map((choice, i) => (
              <Button
                key={choice.uid}
                onClick={() => {
                  setAllyFor(null);
                  act(bloodOn && allyFor.bloodable ? { ...choice.action, blood: true } as Action : choice.action);
                }}
                data-autofocus={i === 0 ? '' : undefined}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
