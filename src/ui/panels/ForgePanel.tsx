// The Forge panel (PLAN §6.3 `CraftingPanel`, DESIGN §8, §16.3 `screen_crafting`; opened from the Explore screen's "Use the
// forge" row): Borin's three jobs as tabs — Upgrade, Craft, Salvage — each a list on the left and the chosen job on the right
// (on a phone the list, then the job with a Back button). A job shows what it needs against what you carry (✓ or ✗ and the
// numbers, never colour alone), the fee after Borin's Favor, the time, and one button that says what it does and what it
// costs; an upgrade that opens a new affix slot shows the three offered and waits for a choice. Keys: U, C, V switch the tab.
//
// Pattern (D-104): `ForgePanel` holds the tab, the selection and the affix choice; `ForgeView` takes props only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ItemIcon } from '../art/ItemIcon';
import { cx } from '../components/Button';
import { ActionButtons, ItemCard, ItemHeader, NeedList } from '../components/items/ItemCard';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { Tabs, tabId, tabPanelId } from '../components/lore/Tabs';
import { NARROW_QUERY, useLoreFocus } from '../components/lore/useLoreFocus';
import type { HotkeyMap } from '../hooks/hotkeys';
import { useHotkeys } from '../hooks/useHotkeys';
import { useListNav } from '../hooks/useListNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import {
  categoryLabel,
  craftDetail,
  forgeModel,
  groupOk,
  recipeLabel,
  salvageDetail,
  upgradeDetail,
  upgradeLabel,
  type BillModel,
  type CraftDetail,
  type ForgeModel,
  type ForgeTab,
  type SalvageDetail,
  type UpgradeDetail,
} from './forgeModel';
import { useRunAction, type PanelAction } from './panelAction';

const ID = 'forge';

export type ForgeDetail = { tab: 'upgrade'; detail: UpgradeDetail } | { tab: 'craft'; detail: CraftDetail } | { tab: 'salvage'; detail: SalvageDetail } | null;

export interface ForgeViewProps {
  model: ForgeModel;
  tab: ForgeTab;
  selectedId: string | null;
  detail: ForgeDetail;
  view: LoreView;
  onTab: (tab: ForgeTab) => void;
  onSelect: (id: string) => void;
  onAffix: (id: string) => void;
  onBack: () => void;
  onRun: (action: PanelAction) => void;
}

export function BillView({ bill, label }: { bill: BillModel; label: string }): ReactNode {
  return (
    <section className="bill" aria-label={label}>
      <h4 className="item-card__heading">{label}</h4>
      {bill.fixed.length === 0 && bill.alternatives.length === 0 ? <p className="panel-note">Gold only: no materials are needed.</p> : null}
      <NeedList needs={bill.fixed} label={`${label}: required`} />
      {bill.alternatives.length === 0 ? null : (
        <div className="bill__either">
          <p className="bill__lead">Plus one of these:</p>
          {bill.alternatives.map((group, i) => (
            <div key={group.map((n) => n.itemId).join('+')} className={cx('bill__group', groupOk(group) && 'bill__group--ok')} data-ok={groupOk(group) ? 'true' : 'false'}>
              <NeedList needs={group} label={`Choice ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ListRow({ id, chosen, rarity, off, label, onSelect, icon, title, meta }: { id: string; chosen: boolean; rarity: string; off: boolean; label: string; onSelect: (id: string) => void; icon: ReactNode; title: string; meta: string }): ReactNode {
  return (
    <li>
      <button
        type="button"
        className={cx('lore-item', 'pack-item', 'trade-line', chosen && 'lore-item--chosen', off && 'trade-line--off')}
        data-list-item=""
        data-item-id={id}
        data-rarity={rarity}
        aria-current={chosen ? 'true' : undefined}
        aria-label={label}
        onClick={() => onSelect(id)}
      >
        {icon}
        <span className="item-line__text">
          <span className="item-line__name">{title}</span>
          <span className="item-line__meta">{meta}</span>
        </span>
      </button>
    </li>
  );
}

export function UpgradeView({ d, onAffix, onRun }: { d: UpgradeDetail; onAffix: (id: string) => void; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="inv-detail forge-detail" data-job="upgrade" data-detail-id={d.uid}>
      <ItemCard facts={d.facts} headingId="forge-detail-heading" />
      {d.note === null ? null : <p className="panel-note">{d.note}</p>}
      {d.targetLabel === null || d.bill === null ? null : (
        <>
          <h4 className="item-card__heading">Upgrade to {d.targetLabel}</h4>
          <p className="panel-note">{d.repLine}</p>
          <BillView bill={d.bill} label="Materials" />
          <p className="forge-fee">{d.feeLine}</p>
          <p className="forge-time">{d.timeLine}</p>
          {d.offers.length === 0 ? null : (
            <fieldset className="offers">
              <legend className="item-card__heading">Choose an affix for the new slot</legend>
              <ul className="offers__list">
                {d.offers.map((o) => (
                  <li key={o.id}>
                    <button type="button" className={cx('offer', o.chosen && 'offer--on')} aria-pressed={o.chosen} data-affix-id={o.id} onClick={() => onAffix(o.id)}>
                      <span className="offer__mark" aria-hidden="true">
                        {o.chosen ? '●' : '○'}
                      </span>
                      <span className="offer__text">
                        <strong>{o.suffix}</strong>
                        {o.text === '' ? '' : `: ${o.text}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {d.after === null ? null : (
            <section className="after" aria-label="As it will be">
              <h4 className="item-card__heading">As it will be</h4>
              <ItemHeader facts={d.after} headingLevel={4} />
              {d.after.stats.length === 0 ? null : (
                <ul className="item-stats" aria-label="Stats after the upgrade">
                  {d.after.stats.map((s) => (
                    <li key={s.key} data-sign={s.value < 0 ? 'minus' : 'plus'}>
                      {s.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
      <ActionButtons actions={[d.action]} onRun={onRun} label="Upgrade" />
    </div>
  );
}

export function CraftView({ d, onRun }: { d: CraftDetail; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="inv-detail forge-detail" data-job="craft" data-recipe-id={d.id}>
      <h3 className="item-head__name" id="forge-detail-heading" tabIndex={-1}>
        {d.name} <span className="branch__count">{d.category}</span>
      </h3>
      <ItemCard facts={d.output} />
      {d.rollsAffixes ? <p className="panel-note">Its affixes are decided at the anvil.</p> : null}
      <BillView bill={d.bill} label="Needs" />
      <p className="forge-fee">{d.feeLine}</p>
      {d.repLine === null ? null : <p className="panel-note">{d.repLine}</p>}
      <p className="forge-time">{d.timeLine}</p>
      <ActionButtons actions={[d.action]} onRun={onRun} label="Craft" />
    </div>
  );
}

export function SalvageView({ d, onRun }: { d: SalvageDetail; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="inv-detail forge-detail" data-job="salvage" data-detail-id={d.uid}>
      <ItemCard facts={d.facts} headingId="forge-detail-heading" />
      <section aria-label="What it breaks down into">
        <h4 className="item-card__heading">Breaks down into</h4>
        {d.yields.length === 0 ? (
          <p className="panel-note">Nothing, while it cannot be salvaged.</p>
        ) : (
          <ul className="item-notes">
            {d.yields.map((y) => (
              <li key={y}>{y}</li>
            ))}
          </ul>
        )}
        <p className="forge-time">The piece is destroyed and pays no gold. No time passes.</p>
      </section>
      <ActionButtons actions={[d.action]} onRun={onRun} label="Salvage" />
    </div>
  );
}

export function ForgeView({ model, tab, selectedId, detail, view, onTab, onSelect, onAffix, onBack, onRun }: ForgeViewProps): ReactNode {
  const h = model.header;
  return (
    <div className="lore-panel forge">
      <div className="panel-bar">
        <span className="panel-bar__chip">{h.smith}</span>
        <span className="panel-bar__chip" aria-label={`Your gold: ${h.gold}`}>
          {h.gold} gold
        </span>
        <span className="panel-bar__chip">{h.standing}</span>
      </div>
      {h.blocked === null ? (
        <p className="panel-note">
          {h.favor === null ? '' : `${h.favor} `}
          {h.timeNote}
        </p>
      ) : (
        <p className="panel-note panel-note--warn" role="status">
          {h.blocked}.
        </p>
      )}
      {model.tabs.length === 0 ? null : (
        <>
          <Tabs tabs={model.tabs} active={tab} label="Forge jobs" idPrefix={ID} onSelect={onTab} />
          <MasterDetail
            view={view}
            listLabel={tab === 'upgrade' ? 'Pieces to upgrade' : tab === 'craft' ? 'Recipes you know' : 'Pieces to salvage'}
            backLabel="Back to the list"
            onBack={onBack}
            panel={{ id: tabPanelId(ID), labelledBy: tabId(ID, tab) }}
            list={
              tab === 'upgrade' ? (
                model.upgrade.length === 0 ? (
                  <p className="lore__empty">You carry nothing Borin can work.</p>
                ) : (
                  <ul className="lore-list">
                    {model.upgrade.map((u) => (
                      <ListRow
                        key={u.row.uid}
                        id={u.row.uid}
                        chosen={selectedId === u.row.uid}
                        rarity={u.row.rarity}
                        off={u.why !== null}
                        label={upgradeLabel(u)}
                        onSelect={onSelect}
                        icon={<ItemIcon icon={u.row.icon} type={u.row.type} rarity={u.row.rarity} affixes={u.row.affixCount} major={u.row.major} size={40} />}
                        title={u.row.name}
                        meta={`${u.row.rarityLabel}${u.worn ? ' · worn' : ''}${u.target === null ? ' · finest' : ` → ${u.target}`}`}
                      />
                    ))}
                  </ul>
                )
              ) : tab === 'craft' ? (
                model.craft.length === 0 ? (
                  <p className="lore__empty">You know no recipes yet. Patterns found in the world teach them.</p>
                ) : (
                  <ul className="lore-list">
                    {model.craft.map((r) => (
                      <ListRow
                        key={r.id}
                        id={r.id}
                        chosen={selectedId === r.id}
                        rarity="common"
                        off={r.why !== null}
                        label={recipeLabel(r)}
                        onSelect={onSelect}
                        icon={<span className="pack-item__empty" aria-hidden="true" />}
                        title={r.name}
                        meta={`${categoryLabel(r.category)}${r.why === null ? ' · ready' : ''}`}
                      />
                    ))}
                  </ul>
                )
              ) : model.salvage.length === 0 ? (
                <p className="lore__empty">You carry no gear to break down. Worn pieces must come off first.</p>
              ) : (
                <ul className="lore-list">
                  {model.salvage.map((u) => (
                    <ListRow
                      key={u.row.uid}
                      id={u.row.uid}
                      chosen={selectedId === u.row.uid}
                      rarity={u.row.rarity}
                      off={u.why !== null}
                      label={`${u.row.name}, ${u.row.rarityLabel} ${u.row.typeLabel.toLowerCase()}${u.why === null ? '' : ', cannot be salvaged'}`}
                      onSelect={onSelect}
                      icon={<ItemIcon icon={u.row.icon} type={u.row.type} rarity={u.row.rarity} affixes={u.row.affixCount} major={u.row.major} size={40} />}
                      title={u.row.name}
                      meta={u.row.rarityLabel}
                    />
                  ))}
                </ul>
              )
            }
            detail={
              detail === null ? (
                <p className="lore__empty">Choose something from the list.</p>
              ) : detail.tab === 'upgrade' ? (
                <UpgradeView d={detail.detail} onAffix={onAffix} onRun={onRun} />
              ) : detail.tab === 'craft' ? (
                <CraftView d={detail.detail} onRun={onRun} />
              ) : (
                <SalvageView d={detail.detail} onRun={onRun} />
              )
            }
          />
        </>
      )}
    </div>
  );
}

export function ForgePanel(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  useLegal();
  const run = useRunAction();
  const narrow = useMediaQuery(NARROW_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  const [tabWanted, setTab] = useState<ForgeTab>('upgrade');
  const [selected, setSelected] = useState<string | null>(null);
  const [affix, setAffix] = useState<string | null>(null);
  const [view, setView] = useState<LoreView>('list');

  const model = useMemo(() => forgeModel(state, content, profile), [state, content, profile]);
  const tab: ForgeTab = model.tabs.some((t) => t.id === tabWanted) ? tabWanted : 'upgrade';
  const ids = tab === 'upgrade' ? model.upgrade.map((u) => u.row.uid) : tab === 'craft' ? model.craft.map((r) => r.id) : model.salvage.map((u) => u.row.uid);
  const chosenId = selected !== null && ids.includes(selected) ? selected : (ids[0] ?? null);
  const detail = useMemo((): ForgeDetail => {
    if (chosenId === null || model.header.blocked !== null) return null;
    const legal = (a: Parameters<typeof store.isLegal>[0]): boolean => store.isLegal(a);
    if (tab === 'upgrade') {
      const d = upgradeDetail(state, content, profile, chosenId, affix, legal);
      return d === null ? null : { tab, detail: d };
    }
    if (tab === 'craft') {
      const d = craftDetail(state, content, profile, chosenId, legal);
      return d === null ? null : { tab, detail: d };
    }
    const d = salvageDetail(state, content, profile, chosenId, legal);
    return d === null ? null : { tab, detail: d };
  }, [state, content, profile, chosenId, tab, affix, model.header.blocked, store]);

  // a piece that was upgraded changes its offers; a salvaged one leaves: back to the list
  const gone = selected !== null && !ids.includes(selected);
  useEffect(() => {
    if (gone) {
      setSelected(null);
      setView('list');
    }
  }, [gone]);
  const rarityKey = detail?.tab === 'upgrade' ? `${detail.detail.facts.rarity}|${detail.detail.facts.affixes.length}` : '';
  useEffect(() => {
    setAffix(null);
  }, [chosenId, rarityKey]);
  useLoreFocus(rootRef, view, narrow);
  useListNav(rootRef, '[data-list-item]', 'Forge');

  const stamp = `${state.player.gold}|${state.player.inventory.length}|${ids.length}|${rarityKey}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = rootRef.current;
    const active = document.activeElement;
    if (root !== null && (active === null || active === document.body || !root.contains(active))) {
      root.querySelector<HTMLElement>('#forge-detail-heading, .lore__list [aria-current="true"], [role="tab"][aria-selected="true"]')?.focus();
    }
  }, [stamp]);

  const switchTab = (t: ForgeTab): void => {
    setTab(t);
    setSelected(null);
    setAffix(null);
    setView('list');
  };
  const keys: HotkeyMap = {};
  if (model.tabs.length > 0) {
    keys.u = { run: () => switchTab('upgrade'), label: 'Upgrade tab', group: 'action' };
    keys.c = { run: () => switchTab('craft'), label: 'Craft tab', group: 'action' };
    keys.v = { run: () => switchTab('salvage'), label: 'Salvage tab', group: 'action' };
  }
  useHotkeys(keys, { scope: 'Forge', level: 'inPanel' });

  return (
    <div ref={rootRef}>
      <ForgeView
        model={model}
        tab={tab}
        selectedId={chosenId}
        detail={detail}
        view={view}
        onTab={switchTab}
        onSelect={(id) => {
          setSelected(id);
          setAffix(null);
          setView('detail');
        }}
        onAffix={(id) => setAffix(id)}
        onBack={() => setView('list')}
        onRun={run}
      />
    </div>
  );
}
