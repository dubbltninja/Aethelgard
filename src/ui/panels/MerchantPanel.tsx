// The Merchant panel (PLAN §6.3 `MerchantPanel`, DESIGN §7.5, §9, §16.3 `screen_merchant`; opened from the Explore screen's
// "Trade with …" row): who is trading and how they price you, a Buy tab (the stall: each line with its price and what is left)
// and a Sell tab (your pack, at 75% of its worth), a list on the left and the chosen line on the right (on a phone the list,
// then the line with a Back button): the item's card, for gear the change in your numbers, the price, a quantity stepper for
// stacks, and one button that says what it does and what it costs. A merchant who refuses says so and shows no stall.
//
// Pattern (D-104): `MerchantPanel` holds the tab, the selection and the quantity; `MerchantView` takes props only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ItemIcon } from '../art/ItemIcon';
import { cx } from '../components/Button';
import { ActionButtons, CompareList, ItemCard, QtyStepper } from '../components/items/ItemCard';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { Tabs, tabId, tabPanelId } from '../components/lore/Tabs';
import { NARROW_QUERY, useLoreFocus } from '../components/lore/useLoreFocus';
import { useListNav } from '../hooks/useListNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import { merchantModel, tradeDetail, tradeLabel, type MerchantModel, type TradeDetail, type TradeRow, type TradeTab } from './merchantModel';
import { useRunAction, type PanelAction } from './panelAction';

const ID = 'merchant';

export interface MerchantViewProps {
  model: MerchantModel;
  tab: TradeTab;
  selectedId: string | null;
  detail: TradeDetail | null;
  view: LoreView;
  onTab: (tab: TradeTab) => void;
  onMerchant: (id: string) => void;
  onSelect: (uid: string) => void;
  onQty: (qty: number) => void;
  onBack: () => void;
  onRun: (action: PanelAction) => void;
}

function Line({ t, mode, chosen, onSelect }: { t: TradeRow; mode: TradeTab; chosen: boolean; onSelect: (uid: string) => void }): ReactNode {
  const { row } = t;
  return (
    <li>
      <button
        type="button"
        className={cx('lore-item', 'pack-item', 'trade-line', chosen && 'lore-item--chosen', t.why !== null && 'trade-line--off')}
        data-list-item=""
        data-item-id={row.uid}
        data-item={row.itemId}
        data-rarity={row.isGear ? row.rarity : 'common'}
        aria-current={chosen ? 'true' : undefined}
        aria-label={tradeLabel(t, mode)}
        onClick={() => onSelect(row.uid)}
      >
        <ItemIcon icon={row.icon} type={row.type} rarity={row.rarity} affixes={row.affixCount} major={row.major} size={40} />
        <span className="item-line__text">
          <span className="item-line__name">
            {row.name}
            {t.stock !== null && t.stock > 1 ? ` × ${t.stock}` : ''}
          </span>
          <span className="item-line__meta">{row.isGear ? `${row.rarityLabel} · ${row.typeLabel}` : row.typeLabel}</span>
        </span>
        <span className="trade-line__price" aria-hidden="true">
          {t.why !== null && mode === 'sell' ? '—' : `${t.unit}g`}
        </span>
      </button>
    </li>
  );
}

export function TradeDetailView({ detail, onQty, onRun }: { detail: TradeDetail; onQty: (n: number) => void; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="inv-detail trade-detail" data-detail-id={detail.uid} data-mode={detail.mode}>
      <ItemCard facts={detail.facts} headingId="trade-detail-heading" />
      <div className="trade-price">
        <p className="trade-price__unit">{detail.priceLine}</p>
        <p className="trade-price__stock">{detail.stockLine}</p>
      </div>
      {detail.maxQty > 1 ? <QtyStepper label={detail.mode === 'buy' ? 'Quantity to buy' : 'Quantity to sell'} value={detail.qty} max={detail.maxQty} onChange={onQty} /> : null}
      <p className="trade-total" aria-live="polite">
        {detail.mode === 'buy' ? 'Total' : 'You receive'}: <strong>{detail.total} gold</strong>
      </p>
      <ActionButtons actions={[detail.action]} onRun={onRun} label={detail.mode === 'buy' ? 'Buy' : 'Sell'} />
      <CompareList compare={detail.compare} />
    </div>
  );
}

export function MerchantView({ model, tab, selectedId, detail, view, onTab, onMerchant, onSelect, onQty, onBack, onRun }: MerchantViewProps): ReactNode {
  const header = model.header;
  if (header === null) {
    return (
      <div className="lore-panel merchant">
        <p className="lore__empty">There is no one here to trade with.</p>
      </div>
    );
  }
  const rows = tab === 'buy' ? model.buy : model.sell;
  return (
    <div className="lore-panel merchant" data-merchant={header.id}>
      <div className="panel-bar">
        <span className="panel-bar__chip">{header.name}</span>
        <span className="panel-bar__chip" aria-label={`Your gold: ${model.gold}`}>
          {model.gold} gold
        </span>
        <span className="panel-bar__chip" aria-label={`Pack: ${model.packUsed} of 40 slots used`}>
          Pack {model.packUsed} / 40
        </span>
      </div>
      {model.merchants.length > 1 ? (
        <div className="filter-row" role="group" aria-label="Who to trade with">
          {model.merchants.map((m) => (
            <button key={m.id} type="button" className={cx('chip', m.id === header.id && 'chip--on')} aria-pressed={m.id === header.id} onClick={() => onMerchant(m.id)}>
              {m.name}
            </button>
          ))}
        </div>
      ) : null}
      {header.role === null ? null : <p className="panel-intro">{header.role}</p>}
      <p className="panel-note" data-testid="standing">
        {header.standing}
        {header.ledger === null ? '' : ` ${header.ledger}`}
      </p>
      {header.refusal === null ? null : (
        <p className="panel-note panel-note--warn" role="status">
          {header.refusal}.
        </p>
      )}
      {model.tabs.length === 0 ? null : (
        <>
          <Tabs tabs={model.tabs} active={tab} label="Buy or sell" idPrefix={ID} onSelect={onTab} />
          <MasterDetail
            view={view}
            listLabel={tab === 'buy' ? 'For sale' : 'Your pack'}
            backLabel={tab === 'buy' ? 'Back to the stall' : 'Back to your pack'}
            onBack={onBack}
            panel={{ id: tabPanelId(ID), labelledBy: tabId(ID, tab) }}
            list={
              rows.length === 0 ? (
                <p className="lore__empty">{tab === 'buy' ? `${header.name} has nothing for sale just now.` : `Nothing in your pack that ${header.name} will take.`}</p>
              ) : (
                <ul className="lore-list">
                  {rows.map((t) => (
                    <Line key={t.row.uid} t={t} mode={tab} chosen={selectedId === t.row.uid} onSelect={onSelect} />
                  ))}
                </ul>
              )
            }
            detail={detail === null ? <p className="lore__empty">Choose something from the list.</p> : <TradeDetailView detail={detail} onQty={onQty} onRun={onRun} />}
          />
        </>
      )}
    </div>
  );
}

export function MerchantPanel(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  useLegal();
  const run = useRunAction();
  const narrow = useMediaQuery(NARROW_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [tabWanted, setTab] = useState<TradeTab>('buy');
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<LoreView>('list');

  const model = useMemo(() => merchantModel(state, content, profile, merchantId, (a) => store.isLegal(a)), [state, content, profile, merchantId, store]);
  const tab: TradeTab = model.tabs.some((t) => t.id === tabWanted) ? tabWanted : (model.tabs[0]?.id ?? 'buy');
  const rows = tab === 'buy' ? model.buy : model.sell;
  const chosen = rows.find((r) => r.row.uid === selected) ?? rows[0] ?? null;
  const chosenId = chosen?.row.uid ?? null;
  const detail = useMemo(
    () => (model.header === null || chosenId === null ? null : tradeDetail(state, content, profile, model.header.id, tab, chosenId, qty, (a) => store.isLegal(a))),
    [state, content, profile, model.header, chosenId, tab, qty, store],
  );

  // a line that sold out (or was sold) leaves the detail pointing at the next one: show the list again on a phone
  const gone = selected !== null && !rows.some((r) => r.row.uid === selected);
  useEffect(() => {
    if (gone) {
      setSelected(null);
      setQty(1);
      setView('list');
    }
  }, [gone]);
  useLoreFocus(rootRef, view, narrow);
  useListNav(rootRef, '[data-list-item]', 'Merchant');

  // After a trade the button that ran may be gone: keep focus inside the panel.
  const stamp = `${state.player.gold}|${state.player.inventory.length}|${rows.length}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = rootRef.current;
    const active = document.activeElement;
    if (root !== null && (active === null || active === document.body || !root.contains(active))) {
      root.querySelector<HTMLElement>('#trade-detail-heading, .lore__list [aria-current="true"], [role="tab"][aria-selected="true"]')?.focus();
    }
  }, [stamp]);

  return (
    <div ref={rootRef}>
      <MerchantView
        model={model}
        tab={tab}
        selectedId={chosenId}
        detail={detail}
        view={view}
        onTab={(t) => {
          setTab(t);
          setSelected(null);
          setQty(1);
          setView('list');
        }}
        onMerchant={(id) => {
          setMerchantId(id);
          setSelected(null);
          setQty(1);
          setView('list');
        }}
        onSelect={(uid) => {
          setSelected(uid);
          setQty(1);
          setView('detail');
        }}
        onQty={setQty}
        onBack={() => setView('list')}
        onRun={(a) => {
          run(a);
          setQty(1);
        }}
      />
    </div>
  );
}
