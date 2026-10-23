// The pieces the item panels share (Inventory, Merchant, Forge; DESIGN §7, §16.3, §17.4). All pure views of props:
//   <ItemHeader>   icon, name and its labels (rarity in words as well as in the frame's pattern),
//   <ItemCard>     a header and the item's description, stats, affixes, passives, effects, requirements and worth,
//   <CompareList>  the change in the Wayfinder's numbers if this piece were worn (one block per slot it fits),
//   <ActionButtons> a row of panel actions, each with the reason it is off written beside it,
//   <QtyStepper>   a − / + counter for stacks (the engine's `qty`),
//   <NeedList>     materials owned against needed.
import type { ReactNode } from 'react';
import { ItemIcon } from '../../art/ItemIcon';
import type { CompareModel, ItemFacts, ItemRowModel } from '../../panels/itemModel';
import type { PanelAction } from '../../panels/panelAction';
import { Button, cx } from '../Button';

export function ItemHeader({ facts, headingLevel = 3, headingId }: { facts: ItemFacts; headingLevel?: 3 | 4; headingId?: string }): ReactNode {
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <div className="item-head" data-rarity={facts.isGear ? facts.rarity : 'common'}>
      <ItemIcon icon={facts.icon} type={facts.type} rarity={facts.rarity} affixes={facts.affixes.length} major={facts.major} size={56} />
      <div className="item-head__text">
        <Heading className="item-head__name" id={headingId} tabIndex={-1}>
          {facts.name}
          {facts.qty > 1 ? <span className="item-head__qty"> × {facts.qty}</span> : null}
        </Heading>
        <p className="item-head__meta">
          {facts.isGear ? <span className="rarity-tag">{facts.rarityLabel}</span> : null}
          <span>{facts.typeLine}</span>
          {facts.bound ? <span className="item-flag">Bound to a quest</span> : null}
        </p>
      </div>
    </div>
  );
}

/** A small icon + name + qty row for lists (the icon is decorative; the button around it carries the full name). */
export function ItemLine({ row }: { row: ItemRowModel }): ReactNode {
  return (
    <>
      <ItemIcon icon={row.icon} type={row.type} rarity={row.rarity} affixes={row.affixCount} major={row.major} size={40} />
      <span className="item-line__text">
        <span className="item-line__name">
          {row.name}
          {row.qty > 1 ? ` × ${row.qty}` : ''}
        </span>
        <span className="item-line__meta">{row.isGear ? `${row.rarityLabel} · ${row.typeLabel}` : row.typeLabel}</span>
      </span>
    </>
  );
}

export function ItemCard({ facts, headingId }: { facts: ItemFacts; headingId?: string }): ReactNode {
  return (
    <div className="item-card" data-rarity={facts.isGear ? facts.rarity : 'common'}>
      <ItemHeader facts={facts} {...(headingId === undefined ? {} : { headingId })} />
      <p className="item-card__description">{facts.description}</p>
      {facts.stats.length === 0 ? null : (
        <ul className="item-stats" aria-label="Stats">
          {facts.stats.map((s) => (
            <li key={s.key} data-sign={s.value < 0 ? 'minus' : 'plus'}>
              {s.text}
            </li>
          ))}
        </ul>
      )}
      {facts.affixes.length === 0 ? null : (
        <section aria-label="Affixes">
          <h4 className="item-card__heading">Affixes</h4>
          <ul className="item-notes">
            {facts.affixes.map((a) => (
              <li key={a.id}>
                <strong>{a.suffix}</strong>
                {a.text === '' ? '' : `: ${a.text}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {facts.passives.length === 0 && facts.effects.length === 0 ? null : (
        <section aria-label="Effects">
          <h4 className="item-card__heading">{facts.isGear ? 'Special' : 'Effect'}</h4>
          <ul className="item-notes">
            {[...facts.effects, ...facts.passives].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {facts.requirements.length === 0 ? null : (
        <section aria-label="Requirements">
          <h4 className="item-card__heading">Needs</h4>
          <ul className="item-notes">
            {facts.requirements.map((r) => (
              <li key={r.text} data-met={r.met ? 'true' : 'false'}>
                <span className="sr-only">{r.met ? 'Met: ' : 'Not met: '}</span>
                {r.text}
                {r.met ? '' : ' (not met)'}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="item-card__value">
        {facts.satchel ? 'Kept in the Satchel.' : `Worth ${facts.value} gold${facts.qty > 1 ? ' each' : ''}.`}
      </p>
    </div>
  );
}

export function CompareList({ compare }: { compare: readonly CompareModel[] }): ReactNode {
  if (compare.length === 0) return null;
  return (
    <section className="compare" aria-label="Compared with what you wear">
      <h4 className="item-card__heading">Compared with what you wear</h4>
      {compare.map((c) => (
        <div key={c.slot} className="compare__slot" data-slot={c.slot}>
          <p className="compare__title">
            {c.slotLabel}: {c.wornName === null ? 'empty' : `replaces ${c.wornName}`}
          </p>
          {c.rows.length === 0 ? (
            <p className="compare__none">No change to your numbers.</p>
          ) : (
            <ul className="compare__rows">
              {c.rows.map((r) => (
                <li key={r.key} data-direction={r.delta > 0 ? 'up' : 'down'}>
                  <span aria-hidden="true" className="compare__arrow">
                    {r.delta > 0 ? '▲' : '▼'}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

export function ActionButtons({ actions, onRun, label = 'Actions' }: { actions: readonly PanelAction[]; onRun: (a: PanelAction) => void; label?: string }): ReactNode {
  if (actions.length === 0) return null;
  return (
    <div className="panel-actions" role="group" aria-label={label}>
      {actions.map((a) => (
        <div key={a.id} className="panel-actions__one">
          <Button
            variant={a.danger === true ? 'danger' : a.primary === true ? 'primary' : 'secondary'}
            disabled={!a.enabled}
            aria-disabled={!a.enabled}
            data-action-id={a.id}
            aria-describedby={a.enabled || a.reason === null ? undefined : `${a.id}-why`}
            onClick={() => onRun(a)}
          >
            {a.label}
          </Button>
          {a.enabled || a.reason === null ? null : (
            <span className="panel-actions__why" id={`${a.id}-why`}>
              {a.reason}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export interface QtyStepperProps {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
}

export function QtyStepper({ label, value, min = 1, max, onChange }: QtyStepperProps): ReactNode {
  return (
    <div className="qty" role="group" aria-label={label}>
      <Button aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </Button>
      <output className="qty__value" aria-live="polite">
        {value}
      </output>
      <Button aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </Button>
      {max > 1 ? (
        <Button variant="quiet" aria-label={`All ${max}`} disabled={value >= max} onClick={() => onChange(max)}>
          All
        </Button>
      ) : null}
    </div>
  );
}

export interface NeedRowModel {
  itemId: string;
  name: string;
  have: number;
  need: number;
  /** A stack that must also stay (the Talisman rule). */
  keep: number;
}

export function NeedList({ needs, label }: { needs: readonly NeedRowModel[]; label: string }): ReactNode {
  if (needs.length === 0) return null;
  return (
    <ul className="needs" aria-label={label}>
      {needs.map((n) => {
        const ok = n.have >= n.need + n.keep;
        return (
          <li key={n.itemId} className={cx('need', ok ? 'need--ok' : 'need--short')} data-ok={ok ? 'true' : 'false'}>
            <span className="need__mark" aria-hidden="true">
              {ok ? '✓' : '✗'}
            </span>
            <span className="need__text">
              {n.name}
              <span className="need__count">
                {' '}
                {n.have} of {n.need}
                {n.keep > 0 ? ` (and keep ${n.keep})` : ''}
              </span>
              <span className="sr-only">{ok ? ', enough' : ', not enough'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
