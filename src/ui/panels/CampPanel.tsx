// The Camp panel (PLAN §6.3, DESIGN §2.1, §10.2, §12; D-059, D-067.14; opened from the Explore screen's "Camp" row): rest with
// its time and what it restores, the conversation a full rest will bring, who travels with you, the way to rethink your
// path, and — from the second loop — *Keep the vigil* and *Let go*, each behind a question. One column, no hidden controls.
//
// Pattern (D-104): `CampPanel` holds nothing but the shell hook; `CampView` takes props only.
import { useMemo, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { ActionButtons } from '../components/items/ItemCard';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import { useShell } from '../shellContext';
import { campModel, type CampModel } from './campModel';
import { useRunAction, type PanelAction } from './panelAction';

export interface CampViewProps {
  model: CampModel;
  onRun: (action: PanelAction) => void;
  onOpenAbilities: () => void;
  canOpenAbilities: boolean;
}

export function CampView({ model, onRun, onOpenAbilities, canOpenAbilities }: CampViewProps): ReactNode {
  const v = model.vitals;
  return (
    <div className="lore-panel camp">
      <div className="panel-bar">
        <span className="panel-bar__chip">
          {model.placeName} · {model.kind}
        </span>
        <span className="panel-bar__chip" aria-label={`Health ${v.hp} of ${v.hpMax}`}>
          HP {v.hp} / {v.hpMax}
        </span>
        <span className="panel-bar__chip" aria-label={`Magic ${v.mp} of ${v.mpMax}`}>
          MP {v.mp} / {v.mpMax}
        </span>
        <span className="panel-bar__chip">{v.gold} gold</span>
      </div>
      {model.readOnly === null ? null : (
        <p className="panel-note" role="status">
          {model.readOnly}
        </p>
      )}
      {model.blurb === null ? null : <p className="panel-intro">{model.blurb}</p>}
      <div className="lore lore--single camp__body">
        <section aria-labelledby="camp-rest" className="camp__section">
          <h3 id="camp-rest" className="branch__name" tabIndex={-1} data-autofocus="">
            Rest
          </h3>
          {model.rests.map((r, i) => (
            <div key={r.id} className="camp-rest" data-rest={r.id}>
              <ActionButtons actions={[r]} onRun={onRun} label={r.label} />
              <p className="camp-rest__note">{model.restNotes[i]}</p>
            </div>
          ))}
        </section>
        <section aria-labelledby="camp-company" className="camp__section">
          <h3 id="camp-company" className="item-card__heading">
            Company
          </h3>
          <p className="panel-intro">{model.withYou}</p>
          {model.conversation === null ? null : (
            <p className="panel-note" data-testid="camp-conversation">
              {model.conversation}
            </p>
          )}
          <ActionButtons actions={model.swaps} onRun={onRun} label="Who travels with you" />
        </section>
        <section aria-labelledby="camp-path" className="camp__section">
          <h3 id="camp-path" className="item-card__heading">
            Your path
          </h3>
          <p className="panel-intro" data-testid="camp-respec">
            {model.respec.text}
          </p>
          <div className="panel-actions">
            <div className="panel-actions__one">
              <Button variant="secondary" disabled={!canOpenAbilities} data-action-id="open-abilities" onClick={onOpenAbilities}>
                Open Abilities
              </Button>
            </div>
          </div>
        </section>
        {model.loop === null ? null : (
          <section aria-labelledby="camp-loop" className="camp__section">
            <h3 id="camp-loop" className="item-card__heading">
              The Amulet
            </h3>
            <p className="panel-intro">{model.loop.note}</p>
            <ActionButtons actions={[model.loop.vigil, model.loop.letGo]} onRun={onRun} label="Ending the loop" />
          </section>
        )}
      </div>
    </div>
  );
}

export function CampPanel(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  useLegal();
  const run = useRunAction();
  const shell = useShell();
  const model = useMemo(() => campModel(state, content, profile, (a) => store.isLegal(a)), [state, content, profile, store]);
  if (model === null) return <p className="lore__empty">There is nowhere to make camp here.</p>;
  return <CampView model={model} onRun={run} onOpenAbilities={() => shell.openPanel('abilities')} canOpenAbilities={shell.canOpen('abilities')} />;
}
