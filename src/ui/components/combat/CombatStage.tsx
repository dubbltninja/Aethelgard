// The combat stage (U73a; DESIGN §16.5, §17.7, §16.7; docs/ART-2.md §7; D-128): a band at the top of the Combat screen with
// the place's painting behind (U71's backdrop chooser, U72's tint and particles, no focal glow), a floor line, and the figures
// standing on it — the player and the active companion on the left facing right, the enemies on the right facing left, each
// on a soft shadow ellipse, scaled by size class (stageLayout.ts) and never clipped.
//
// - Targeting: each enemy is a button named like its card ("Target The Chronos Tyrant, level 14, boss"), pressed when it is the
//   target; a ring marks the target on the floor. Clicking or tapping one targets it, as the cards and ← / → do. The buttons
//   stay out of the Tab order (tabIndex -1): the cards already give keyboard and screen-reader players the same control.
// - Motion (stageMotion.ts), driven by the step's events and off under reduced motion: an idle bob, a lunge toward the target,
//   a white flash + ≤ 2 px shake on a hit with the number floating from the figure (600 ms; a crit 1.2× once), KO fades and
//   drops, a boss's phase change flares. CSS transforms and filters only.
// - The family sigil stays as a corner badge on every creature (shape for colour-blind players, DESIGN §17.3); a creature with
//   no sprite stands as its sigil.
// - High contrast: the band's painting dims as U71's frames do (explore.css); the figures keep full brightness.
//
// Pure view (D-104) apart from `useStageSize`, which the container calls to measure the band.
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { CreatureSigil } from '../../art/CreatureSigil';
import { NpcSigil } from '../../art/NpcSigil';
import { Sprite } from '../../art/Sprite';
import type { SpriteManifest } from '../../art/spriteManifest';
import { stageLayout, type FigureBox } from '../../art/stageLayout';
import { cueParity, type FigureCues, type StageCues } from '../../art/stageMotion';
import { ClassSigil } from '../../screens/ClassSigil';
import type { StageFigureModel } from './stageModel';

/** Before the band is measured (and in tests): a typical desktop band. */
export const DEFAULT_STAGE_SIZE = { width: 960, height: 300 } as const;

export interface StageSize {
  width: number;
  height: number;
}

/** The band's size, kept current with a ResizeObserver (DEFAULT_STAGE_SIZE until measured). */
export function useStageSize(ref: RefObject<HTMLElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>(DEFAULT_STAGE_SIZE);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const read = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export interface CombatStageProps {
  /** The painted (or drawn) place behind, a <Scene/>. */
  scene: ReactNode;
  figures: readonly StageFigureModel[];
  size: StageSize;
  cues: StageCues;
  reducedMotion: boolean;
  onSelect: (uid: string) => void;
  bandRef?: RefObject<HTMLDivElement | null>;
  manifest?: SpriteManifest;
}

const px = (n: number): string => `${n}px`;
const ms = (n: number): string => `${Math.round(n)}ms`;

function fallbackOf(f: StageFigureModel): ReactNode {
  if (f.creature !== null) return <CreatureSigil creatureId={f.creature.id} sigil={f.creature.sigil} family={f.creature.family} size="lg" state={f.alive ? 'idle' : 'ko'} reducedMotion />;
  if (f.npcSigil !== null) return <NpcSigil sigilKey={f.npcSigil.key} {...(f.npcSigil.accent === undefined ? {} : { accent: f.npcSigil.accent })} size="lg" />;
  return (
    <span className="stage-fig__class-sigil">
      <ClassSigil classId={f.classId ?? ''} size={96} />
    </span>
  );
}

interface FigureProps {
  f: StageFigureModel;
  box: FigureBox;
  index: number;
  cues: FigureCues | null;
  parity: 'a' | 'b';
  motion: boolean;
  onSelect: (uid: string) => void;
  manifest?: SpriteManifest;
}

export function StageFigure({ f, box, index, cues, parity, motion, onSelect, manifest }: FigureProps): ReactNode {
  const c = motion ? cues : null;
  const hit = c?.hits[0] ?? null;
  const style: CSSProperties = { left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h), zIndex: box.z };
  const classes = [
    'stage-fig',
    `stage-fig--${f.side}`,
    c?.lunge != null ? `stage-fig--lunge-${parity}` : null,
    hit !== null ? `stage-fig--hit-${parity}` : null,
    c?.ko != null ? `stage-fig--fall-${parity}` : null,
    c?.flare != null ? `stage-fig--flare-${parity}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const vars = {
    '--lunge-delay': ms(c?.lunge ?? 0),
    '--hit-delay': ms(hit?.delay ?? 0),
    '--ko-delay': ms(c?.ko ?? 0),
    '--flare-delay': ms(c?.flare ?? 0),
    '--bob-delay': `-${(index * 0.73) % 2.8}s`,
  } as CSSProperties;
  const body = (
    <>
      <span className="stage-fig__shadow" aria-hidden="true" />
      {f.selected && f.alive ? <span className="stage-fig__ring" aria-hidden="true" /> : null}
      {c?.flare != null ? <span className="stage-fig__flare" aria-hidden="true" /> : null}
      <span className="stage-fig__ko" aria-hidden="true">
        <span className="stage-fig__lunge">
          <span className="stage-fig__bob">
            <span className="stage-fig__hit">
              <Sprite
                file={f.sprite?.file ?? null}
                flip={f.sprite?.flip ?? false}
                effect={f.sprite?.effect ?? null}
                revealed={f.wounded}
                fallback={fallbackOf(f)}
                manifest={manifest}
              />
            </span>
          </span>
        </span>
      </span>
      {f.creature === null ? null : (
        <span className="stage-fig__badge" aria-hidden="true">
          <CreatureSigil creatureId={f.creature.id} sigil={f.creature.sigil} family={f.creature.family} size="sm" reducedMotion />
        </span>
      )}
      {(c?.hits ?? []).map((h, i) => (
        <span
          key={`${parity}${i}`}
          className={`stage-float${h.crit ? ' stage-float--crit' : ''}`}
          style={{ animationDelay: ms(h.delay), left: `${50 + ((i % 3) - 1) * 16}%` }}
          aria-hidden="true"
        >
          −{h.amount}
        </span>
      ))}
    </>
  );
  const data = {
    'data-uid': f.uid,
    'data-role': f.role,
    'data-size': f.size,
    'data-ko': f.alive ? undefined : 'true',
    'data-selected': f.selected && f.alive ? 'true' : undefined,
    'data-boss': f.boss ? 'true' : undefined,
    'data-back': box.back ? 'true' : undefined,
  };
  if (f.side === 'enemy') {
    return (
      <button
        type="button"
        className={classes}
        style={{ ...style, ...vars }}
        {...data}
        tabIndex={-1}
        aria-label={f.label ?? f.name}
        aria-pressed={f.alive ? f.selected : undefined}
        aria-disabled={f.alive ? undefined : 'true'}
        onClick={() => {
          if (f.alive) onSelect(f.uid);
        }}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={classes} style={{ ...style, ...vars }} {...data} aria-hidden="true">
      {body}
    </div>
  );
}

/** The cold line between tethered figures (the Tethered Stalkers): consecutive standing pairs, chest to chest. */
export function tetherLines(figures: readonly StageFigureModel[], boxes: readonly FigureBox[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const at = new Map(boxes.map((b) => [b.uid, b]));
  const tethered = figures.filter((f) => f.alive && f.sprite?.effect?.kind === 'tethered').map((f) => at.get(f.uid)).filter((b): b is FigureBox => b !== undefined);
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < tethered.length; i++) {
    const a = tethered[i - 1] as FigureBox;
    const b = tethered[i] as FigureBox;
    out.push({ x1: a.x + a.w / 2, y1: a.y + a.h * 0.45, x2: b.x + b.w / 2, y2: b.y + b.h * 0.45 });
  }
  return out;
}

export function CombatStage({ scene, figures, size, cues, reducedMotion, onSelect, bandRef, manifest }: CombatStageProps): ReactNode {
  const layout = stageLayout(
    size.width,
    size.height,
    figures.map((f) => ({ uid: f.uid, side: f.side, size: f.size, aspect: f.aspect })),
  );
  const boxes = new Map(layout.boxes.map((b) => [b.uid, b]));
  const parity = cueParity(cues.nonce);
  const motion = !reducedMotion;
  const tethers = tetherLines(figures, layout.boxes);
  return (
    <div
      className="combat-stage"
      ref={bandRef}
      data-motion={motion ? 'on' : 'off'}
      data-figures={figures.length}
      style={{ '--floor': px(layout.floor) } as CSSProperties}
      role="group"
      aria-label="The fight"
    >
      <div className="combat-stage__scene">{scene}</div>
      <div className="combat-stage__floor" aria-hidden="true" />
      {tethers.length === 0 ? null : (
        <svg className="combat-stage__tethers" width={size.width} height={size.height} aria-hidden="true" focusable="false">
          {tethers.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </svg>
      )}
      {figures.map((f, i) => {
        const box = boxes.get(f.uid);
        return box === undefined ? null : (
          <StageFigure key={f.uid} f={f} box={box} index={i} cues={cues.byUid[f.uid] ?? null} parity={parity} motion={motion} onSelect={onSelect} manifest={manifest} />
        );
      })}
    </div>
  );
}
