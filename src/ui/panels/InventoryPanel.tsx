// Inventory and Equipment (PLAN §6.3 `InventoryPanel`, DESIGN §7, §16.3 `screen_inventory`; hotkey I, Shift+I in a fight): the
// four equipment slots, the pack with its 40-slot counter and type filters, and the Satchel for quest and key items, a list
// on the left and the chosen piece on the right (on a phone the list, then the piece with a Back button). The piece shows
// its card — rarity in words and in the icon's frame, stats at its rarity, each affix and passive in plain words, what it
// asks of the wearer — the change in your numbers if you wore it instead of what you wear, and Wear / Take off / Use / Read /
// Drop, each off with the engine's reason when it cannot be done. Dropping something that matters asks first, and Delete
// always asks. Keys: ↑/↓ move in the list, Enter chooses, E wears or takes off, U uses or reads, Delete drops.
//
// Pattern (D-104): `InventoryPanel` holds the filter and the selection; `InventoryView` takes props only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ItemIcon } from '../art/ItemIcon';
import { cx } from '../components/Button';
import { ActionButtons, CompareList, ItemCard, ItemLine } from '../components/items/ItemCard';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { NARROW_QUERY, useLoreFocus } from '../components/lore/useLoreFocus';
import type { HotkeyMap } from '../hooks/hotkeys';
import { useHotkeys } from '../hooks/useHotkeys';
import { useListNav } from '../hooks/useListNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import {
  DEFAULT_SELECTION,
  deleteQuestion,
  inventoryDetail,
  inventoryModel,
  resolveSelection,
  slotLabel,
  type InventoryDetail,
  type InventoryModel,
  type PackFilter,
  type SlotRow,
} from './inventoryModel';
import { rowLabel, type ItemRowModel } from './itemModel';
import { useRunAction, type PanelAction } from './panelAction';

export interface InventoryViewProps {
  model: InventoryModel;
  filter: PackFilter;
  selectedId: string;
  detail: InventoryDetail;
  view: LoreView;
  onFilter: (filter: PackFilter) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRun: (action: PanelAction) => void;
}

function SlotButton({ row, chosen, onSelect }: { row: SlotRow; chosen: boolean; onSelect: (id: string) => void }): ReactNode {
  return (
    <li>
      <button
        type="button"
        className={cx('lore-item', 'pack-item', chosen && 'lore-item--chosen')}
        data-list-item=""
        data-item-id={row.id}
        data-autofocus={chosen ? '' : undefined}
        aria-current={chosen ? 'true' : undefined}
        aria-label={slotLabel(row)}
        onClick={() => onSelect(row.id)}
      >
        {row.item === null ? (
          <>
            <span className="pack-item__empty" aria-hidden="true" />
            <span className="item-line__text">
              <span className="item-line__name">{row.label}</span>
              <span className="item-line__meta">Empty</span>
            </span>
          </>
        ) : (
          <>
            <ItemIcon icon={row.item.icon} type={row.item.type} rarity={row.item.rarity} affixes={row.item.affixCount} major={row.item.major} size={40} />
            <span className="item-line__text">
              <span className="item-line__name">{row.item.name}</span>
              <span className="item-line__meta">
                {row.label} · {row.item.rarityLabel}
              </span>
            </span>
          </>
        )}
      </button>
    </li>
  );
}

function PackButton({ row, chosen, onSelect }: { row: ItemRowModel; chosen: boolean; onSelect: (id: string) => void }): ReactNode {
  return (
    <li>
      <button
        type="button"
        className={cx('lore-item', 'pack-item', chosen && 'lore-item--chosen')}
        data-list-item=""
        data-item-id={row.uid}
        data-rarity={row.isGear ? row.rarity : 'common'}
        aria-current={chosen ? 'true' : undefined}
        aria-label={rowLabel(row, [row.bound ? 'bound to a quest' : null])}
        onClick={() => onSelect(row.uid)}
      >
        <ItemLine row={row} />
      </button>
    </li>
  );
}

export function InventoryView({ model, filter, selectedId, detail, view, onFilter, onSelect, onBack, onRun }: InventoryViewProps): ReactNode {
  return (
    <div className="lore-panel inventory">
      <div className="panel-bar">
        <span className="panel-bar__chip" aria-label={`Pack: ${model.used} of ${model.max} slots used`}>
          Pack {model.used} / {model.max}
        </span>
        <span className="panel-bar__chip">{model.gold} gold</span>
        {model.full ? <span className="panel-bar__chip panel-bar__chip--warn">Pack full</span> : null}
      </div>
      {model.readOnly === null ? null : (
        <p className="panel-note" role="status">
          {model.readOnly}
        </p>
      )}
      <MasterDetail
        view={view}
        listLabel="Equipment and pack"
        backLabel="Back to the list"
        onBack={onBack}
        list={
          <div className="pack-list">
            <section aria-labelledby="inv-equipped">
              <h3 id="inv-equipped" className="lore-group__heading">
                Worn
              </h3>
              <ul className="lore-list">
                {model.slots.map((row) => (
                  <SlotButton key={row.id} row={row} chosen={selectedId === row.id || selectedId === row.item?.uid} onSelect={(id) => onSelect(row.item === null ? id : row.item.uid)} />
                ))}
              </ul>
            </section>
            <section aria-labelledby="inv-pack">
              <h3 id="inv-pack" className="lore-group__heading">
                Pack <span className="lore-group__count">{model.used} of {model.max} slots</span>
              </h3>
              <div className="filter-row" role="group" aria-label="Show in the pack">
                {model.filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cx('chip', filter === f.id && 'chip--on')}
                    aria-pressed={filter === f.id}
                    aria-label={`${f.label}, ${f.count}`}
                    onClick={() => onFilter(f.id)}
                  >
                    {f.label}
                    <span className="chip__count" aria-hidden="true">
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
              {model.pack.length === 0 ? (
                <p className="lore__empty">{filter === 'all' ? 'Your pack is empty.' : 'Nothing of that kind in your pack.'}</p>
              ) : (
                <ul className="lore-list">
                  {model.pack.map((row) => (
                    <PackButton key={row.uid} row={row} chosen={selectedId === row.uid} onSelect={onSelect} />
                  ))}
                </ul>
              )}
            </section>
            {model.satchel.length === 0 ? null : (
              <section aria-labelledby="inv-satchel">
                <h3 id="inv-satchel" className="lore-group__heading">
                  Satchel <span className="lore-group__count">quest and key items</span>
                </h3>
                <ul className="lore-list">
                  {model.satchel.map((row) => (
                    <PackButton key={row.uid} row={row} chosen={selectedId === row.uid} onSelect={onSelect} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        }
        detail={<DetailView detail={detail} onRun={onRun} />}
      />
    </div>
  );
}

export function DetailView({ detail, onRun }: { detail: InventoryDetail; onRun: (action: PanelAction) => void }): ReactNode {
  return (
    <div className="inv-detail" data-detail-id={detail.id}>
      {detail.facts === null ? (
        <div className="item-card item-card--empty">
          <h3 className="item-head__name" tabIndex={-1}>
            {detail.slotLabel ?? 'Unknown item'}: empty
          </h3>
        </div>
      ) : (
        <ItemCard facts={detail.facts} headingId="inv-detail-heading" />
      )}
      {detail.note === null ? null : <p className="panel-note">{detail.note}</p>}
      <ActionButtons actions={detail.actions} onRun={onRun} label="What you can do with it" />
      <CompareList compare={detail.compare} />
    </div>
  );
}

export function InventoryPanel(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  useLegal(); // re-render when what is legal changes
  const run = useRunAction();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [filter, setFilter] = useState<PackFilter>('all');
  const [selected, setSelected] = useState<string>(DEFAULT_SELECTION);
  const [view, setView] = useState<LoreView>('list');
  const rootRef = useRef<HTMLDivElement>(null);

  const model = useMemo(() => inventoryModel(state, content, filter), [state, content, filter]);
  const picked = resolveSelection(state, selected) ?? resolveSelection(state, DEFAULT_SELECTION);
  const shown = picked === null ? null : picked;
  const detail = useMemo(
    () => (shown === null ? null : inventoryDetail(state, content, profile, shown, (a) => store.isLegal(a))),
    [state, content, profile, shown, store],
  );
  const selectedId = shown === null ? DEFAULT_SELECTION : shown.kind === 'slot' && shown.inst === null ? `slot:${shown.slot}` : (shown.inst as { uid: string }).uid;

  // a dropped or sold piece leaves the detail empty: back to the list
  const gone = resolveSelection(state, selected) === null;
  useEffect(() => {
    if (gone) {
      setSelected(DEFAULT_SELECTION);
      setView('list');
    }
  }, [gone]);
  useLoreFocus(rootRef, view, narrow);
  useListNav(rootRef, '[data-list-item]', 'Inventory');

  // After an action the button that ran may be gone (Wear becomes Take off): keep focus inside the panel.
  const actionKey = detail === null ? '' : `${detail.id}|${detail.wornIn ?? ''}|${detail.actions.map((a) => a.id).join(',')}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = rootRef.current;
    const active = document.activeElement;
    if (root !== null && (active === null || active === document.body || !root.contains(active))) {
      root.querySelector<HTMLElement>('#inv-detail-heading, .lore__list [aria-current="true"]')?.focus();
    }
  }, [actionKey]);

  const keys: HotkeyMap = {};
  const find = (...ids: string[]): PanelAction | undefined => detail?.actions.find((a) => ids.includes(a.id) && a.enabled);
  const wear = find('unequip', 'equip-weapon', 'equip-armor', 'equip-trinket1');
  const use = find('use', 'read');
  const drop = find('drop');
  if (wear !== undefined) keys.e = { run: () => run(wear), label: wear.label, group: 'action' };
  if (use !== undefined) keys.u = { run: () => run(use), label: use.label, group: 'action' };
  if (drop !== undefined && shown?.kind === 'item' && shown.inst !== null) {
    const def = content.items[shown.inst.itemId];
    const inst = shown.inst;
    if (def !== undefined) {
      keys.delete = {
        run: () => store.dispatch(drop.action),
        label: 'Drop the chosen item',
        group: 'action',
        confirm: deleteQuestion(def, inst, content),
      };
    }
  }
  useHotkeys(keys, { scope: 'Inventory', level: 'inPanel' });

  if (detail === null) return null;
  return (
    <div ref={rootRef}>
      <InventoryView
        model={model}
        filter={filter}
        selectedId={selectedId}
        detail={detail}
        view={view}
        onFilter={setFilter}
        onSelect={(id) => {
          setSelected(id);
          setView('detail');
        }}
        onBack={() => setView('list')}
        onRun={run}
      />
    </div>
  );
}
