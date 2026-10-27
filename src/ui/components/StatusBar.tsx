// The HUD (DESIGN §16.2): name, class and level with the XP bar; HP (red) and the class resource (blue, by its name:
// Focus, Mana, Grit …) as `role="meter"` bars with their numbers; gold; the clock chip; the loop; Corruption pips
// (0–6) once the first spellbook is read; the statuses that persist out of combat (icon + name + watches left); the
// companion's mini-card (with its small painted portrait, U73a). `detail` (H) adds the stats, unspent points and what has
// moved the clock. Pure.
import type { ReactNode } from 'react';
import { Icon } from '../art/Icon';
import { Portrait } from '../art/Portrait';
import type { HudModel } from '../screens/exploreModel';
import { ClockWidget } from './ClockWidget';

export interface MeterProps {
  kind: 'hp' | 'mp' | 'xp' | 'companion';
  label: string;
  value: number;
  max: number;
  /** Visible text after the label (default "value / max"). */
  text?: string;
}

/** A labelled bar with its numbers (DESIGN §16.7: HP bars are `role="meter"`). */
export function Meter({ kind, label, value, max, text }: MeterProps): ReactNode {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const shown = text ?? `${value} / ${max}`;
  return (
    <div
      className={`meter meter--${kind}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max}`}
    >
      <span className="meter__label" aria-hidden="true">
        {label}
      </span>
      <span className="meter__track" aria-hidden="true">
        <span className="meter__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="meter__value" aria-hidden="true">
        {shown}
      </span>
    </div>
  );
}

const pips = (n: number, max: number): ReactNode[] =>
  Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? 'pip pip--on' : 'pip'} />);

export interface StatusBarProps {
  hud: HudModel;
  /** HUD detail (H): stats, unspent points, the clock's audit trail. */
  detail?: boolean;
}

export function StatusBar({ hud, detail = false }: StatusBarProps): ReactNode {
  return (
    <section className="hud" aria-label="Status" data-detail={detail ? 'on' : 'off'}>
      <div className="hud__who">
        <p className="hud__name">
          <span className="hud__player">{hud.name}</span>{' '}
          <span className="hud__class">
            {hud.className} · Level {hud.level}
          </span>
        </p>
        {hud.xpNext === null ? null : <Meter kind="xp" label="Experience" value={hud.xp} max={hud.xpNext} text={`${hud.xp} / ${hud.xpNext} XP`} />}
      </div>
      <div className="hud__vitals">
        <Meter kind="hp" label="HP" value={hud.hp} max={hud.hpMax} />
        <Meter kind="mp" label={hud.resourceName} value={hud.mp} max={hud.mpMax} />
      </div>
      <div className="hud__chips">
        <ClockWidget clock={hud.clock} detail={detail} />
        <span className="hud-chip hud-chip--gold">
          <Icon kind="gold" size={18} />
          <span>{hud.gold} gold</span>
        </span>
        <span className="hud-chip hud-chip--loop">
          <Icon kind="loop" size={18} />
          <span>Loop {hud.loop}</span>
        </span>
        {hud.showCorruption ? (
          <span className="hud-chip hud-chip--corruption" role="img" aria-label={`Corruption ${hud.corruption} of ${hud.corruptionMax}`}>
            <Icon kind="corruption" size={18} />
            <span className="pips" aria-hidden="true">
              {pips(hud.corruption, hud.corruptionMax)}
            </span>
          </span>
        ) : null}
        {hud.statuses.map((st) => (
          <span key={st.id} className="hud-chip hud-chip--status" data-status={st.id}>
            <Icon kind={st.icon} size={18} />
            <span>
              {st.name}
              {st.left === null ? '' : ` · ${st.left}`}
            </span>
          </span>
        ))}
        {hud.statPoints > 0 || hud.abilityPoints > 0 ? (
          <span className="hud-chip hud-chip--points">
            <Icon kind="xp" size={18} />
            <span>
              {[hud.statPoints > 0 ? `${hud.statPoints} stat point${hud.statPoints === 1 ? '' : 's'}` : null, hud.abilityPoints > 0 ? `${hud.abilityPoints} AP` : null]
                .filter((x) => x !== null)
                .join(' · ')}{' '}
              to spend
            </span>
          </span>
        ) : null}
      </div>
      {hud.companion === null ? null : (
        <div className="hud__companion">
          {hud.companion.npcId === undefined ? null : <Portrait npcId={hud.companion.npcId} size="sm" fallback={null} />}
          <Meter
            kind="companion"
            label={hud.companion.name}
            value={hud.companion.hp}
            max={hud.companion.hpMax}
            text={hud.companion.ko ? 'Knocked out' : `${hud.companion.hp} / ${hud.companion.hpMax} · ${hud.companion.stance}`}
          />
        </div>
      )}
      {detail ? (
        <dl className="hud__detail">
          <div>
            <dt>Strength</dt>
            <dd>{hud.stats.strength}</dd>
          </div>
          <div>
            <dt>Magic</dt>
            <dd>{hud.stats.magic}</dd>
          </div>
          <div>
            <dt>Agility</dt>
            <dd>{hud.stats.agility}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
