// The Dialogue screen (PLAN §6.3, DESIGN §13.2, §16.3 `screen_dialogue`): who speaks (a portrait sigil, a name, a role),
// what they say (the first text variant that holds), the answers stacked and numbered 1–9 — each with its glyph and word
// (Echo, class, faction, companion), the greyed ones with the reason they are closed (D-105) — or a Continue button; the
// companion who listens; and the back-log of the scene so far. It answers only with the engine's `choose` and `continue`.
//
// Keys: 1–9 take that answer, Enter or Space continues, ↑/↓ move between the answers. There is no Esc: the engine has no way
// to walk out of a scene (the only exits are its answers), and a conversation that ended by itself returns to the place it
// interrupted. Touch: every answer is a full-width button of at least 44 px.
//
// Pattern (D-104): the container gathers hooks and builds the model with `dialogueModel`; `DialogueView` takes props only.
// After a node changes, focus goes to the new first answer (or Continue), so a keyboard or screen-reader player never
// loses their place; the line itself is a polite live region.
//
// U73a (D-128, docs/ART-2.md §7): the speaker's painted portrait, large, beside the text, over a dimmed copy of the place's
// painting (U71's backdrop chooser); a creature that speaks stands as its sprite, the player as their class sprite. With no
// file (or a failed load) each falls back to its code sigil. The listening companion's chip uses the small portrait.
import { useMemo, useRef, type ReactNode } from 'react';
import { CreatureSigil } from '../art/CreatureSigil';
import { Icon, type IconKind } from '../art/Icon';
import { NpcSigil } from '../art/NpcSigil';
import { Portrait } from '../art/Portrait';
import { RegionPalette } from '../art/RegionPalette';
import { SMALL_MEDIA } from '../art/SceneBackdrop';
import { Sprite } from '../art/Sprite';
import type { ArtFiles } from '../art/sceneManifest';
import { creatureSprite, heroSprite } from '../art/sprites';
import { useBackdrop } from '../art/useBackdrop';
import { Button, cx } from '../components/Button';
import type { HotkeyMap } from '../hooks/hotkeys';
import { useHotkeys } from '../hooks/useHotkeys';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useViewFocus } from '../hooks/useViewFocus';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import { choiceName, dialogueModel, type BacklogLine, type ChoiceRow, type DialogueModel, type SpeakerModel } from './dialogueModel';

const TAG_ICONS: Readonly<Record<string, IconKind>> = { echo: 'echo', class: 'ability', faction: 'crown', companion: 'npc' };

export interface PortraitProps {
  speaker: SpeakerModel;
  size?: 'sm' | 'md' | 'lg';
  reducedMotion?: boolean;
}

/** A speaker's picture: a creature's sprite (else its sigil), a person's painted portrait (else their portrait sigil), the
 * player's class sprite, or the narrator's quiet mark. */
export function SpeakerPortrait({ speaker, size = 'lg', reducedMotion = true }: PortraitProps): ReactNode {
  if (speaker.creature !== null) {
    const sigil = (
      <CreatureSigil
        creatureId={speaker.creature.id}
        {...(speaker.creature.sigil === undefined ? {} : { sigil: speaker.creature.sigil })}
        {...(speaker.creature.family === undefined ? {} : { family: speaker.creature.family })}
        size={size}
        reducedMotion={reducedMotion}
      />
    );
    const sprite = creatureSprite(speaker.creature.id, '', 'left');
    return sprite === null ? sigil : <Sprite file={sprite.file} flip={sprite.flip} effect={sprite.effect} fallback={sigil} className="speaker-sprite" />;
  }
  if (speaker.portrait !== null) {
    const sigil = <NpcSigil sigilKey={speaker.portrait.sigil} {...(speaker.portrait.accent === undefined ? {} : { accent: speaker.portrait.accent })} size={size} />;
    if (speaker.kind === 'player') {
      const hero = heroSprite(speaker.portrait.sigil);
      return <Sprite file={hero.file} fallback={sigil} className="speaker-sprite" />;
    }
    return (
      <Portrait
        npcId={speaker.id}
        size={size === 'lg' ? 'lg' : 'sm'}
        fallback={sigil}
        {...(speaker.portrait.accent === undefined ? {} : { accent: speaker.portrait.accent })}
      />
    );
  }
  return (
    <span className="narrator-mark" aria-hidden="true">
      <Icon kind="look" size={size === 'lg' ? 40 : 24} />
    </span>
  );
}

export interface DialogueViewProps {
  model: DialogueModel;
  /** U73a: the place's painting, shown dimmed behind the speaker (null → none). */
  backdrop?: ArtFiles | null;
  reducedMotion?: boolean;
  onChoose: (id: string) => void;
  onContinue: () => void;
}

function Answer({ row, first, onChoose }: { row: ChoiceRow; first: boolean; onChoose: (id: string) => void }): ReactNode {
  const reasonId = `choice-reason-${row.id}`;
  return (
    <li>
      <button
        type="button"
        className={cx('choice-btn', !row.enabled && 'choice-btn--closed')}
        data-choice-id={row.id}
        data-autofocus={first ? '' : undefined}
        aria-label={choiceName(row)}
        aria-keyshortcuts={row.key ?? undefined}
        aria-disabled={row.enabled ? undefined : 'true'}
        aria-describedby={row.enabled ? undefined : reasonId}
        onClick={() => (row.enabled ? onChoose(row.id) : undefined)}
      >
        {row.key === null ? <span className="choice-btn__key choice-btn__key--none" aria-hidden="true" /> : <kbd className="choice-btn__key">{row.key}</kbd>}
        <span className="choice-btn__body">
          <span className="choice-btn__text">{row.text}</span>
          {row.tags.length === 0 && row.echo === null ? null : (
            <span className="choice-btn__tags" aria-hidden="true">
              {row.tags.map((tag) => (
                <span key={tag.id} className={`choice-tag choice-tag--${tag.id}`}>
                  <Icon kind={TAG_ICONS[tag.id] ?? 'echo'} size={14} />
                  {tag.label}
                </span>
              ))}
              {row.echo === null ? null : <span className="choice-tag choice-tag--known">You know: {row.echo}</span>}
            </span>
          )}
          {row.enabled ? null : (
            <span className="choice-btn__reason" id={reasonId}>
              <Icon kind="lock" size={14} />
              {row.reason}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function BacklogView({ lines }: { lines: readonly BacklogLine[] }): ReactNode {
  if (lines.length === 0) return null;
  return (
    <details className="dialogue__backlog">
      <summary>Earlier in this conversation ({lines.length})</summary>
      <ol className="backlog" aria-label="Earlier lines">
        {lines.map((line) => (
          <li key={line.key} className="backlog__line" data-speaker-kind={line.speaker.kind}>
            <p className="backlog__text">
              {line.speaker.name === null ? null : <span className="backlog__who">{line.speaker.name}: </span>}
              {line.text}
            </p>
            {line.chose === null ? null : (
              <p className="backlog__chose">
                <span className="backlog__who">You: </span>
                {line.chose}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function DialogueView({ model, backdrop = null, reducedMotion = true, onChoose, onContinue }: DialogueViewProps): ReactNode {
  const { speaker } = model;
  const firstEnabled = model.choices.findIndex((c) => c.enabled);
  const anyChoices = model.choices.length > 0;
  return (
    <RegionPalette regionId={model.regionId} className="screen screen--dialogue">
      <section className="dialogue" data-screen="dialogue" data-scene={model.sceneId} aria-labelledby="dialogue-heading">
        <header className="dialogue__head">
          <p className="dialogue__where">{model.place}</p>
          <h1 id="dialogue-heading" className="dialogue__title" tabIndex={-1}>
            {model.title}
          </h1>
          {model.listener === null ? null : (
            <p className="dialogue__listener">
              <Portrait
                npcId={model.listener.npcId ?? null}
                size="sm"
                fallback={<NpcSigil sigilKey={model.listener.sigil} {...(model.listener.accent === undefined ? {} : { accent: model.listener.accent })} size="sm" />}
                {...(model.listener.accent === undefined ? {} : { accent: model.listener.accent })}
              />
              <span>{model.listener.name} is listening.</span>
            </p>
          )}
        </header>
        <div className={['dialogue__stage', backdrop === null ? null : 'dialogue__stage--painted', speaker.kind === 'narrator' ? null : 'dialogue__stage--portrait'].filter(Boolean).join(' ')}>
          {backdrop === null ? null : (
            <picture className="dialogue__backdrop" aria-hidden="true">
              <source media={SMALL_MEDIA} srcSet={backdrop.sm} />
              <img src={backdrop.lg} alt="" decoding="async" draggable={false} />
            </picture>
          )}
          <figure className="dialogue__portrait" data-speaker-kind={speaker.kind}>
            <SpeakerPortrait speaker={speaker} reducedMotion={reducedMotion} />
            {speaker.name === null ? null : (
              <figcaption className="dialogue__caption">
                <span className="dialogue__name">{speaker.name}</span>
                {speaker.role === null ? null : <span className="dialogue__role">{speaker.role}</span>}
                {speaker.faction === null ? null : <span className="dialogue__faction">{speaker.faction}</span>}
              </figcaption>
            )}
          </figure>
          <div className="dialogue__body">
            <div className="dialogue__line" aria-live="polite" aria-atomic="true" data-mood={model.mood} data-speaker-kind={speaker.kind}>
              {speaker.name === null ? null : <p className="dialogue__speaker">{speaker.name}</p>}
              <p className="dialogue__text">{model.text}</p>
            </div>
            {anyChoices ? (
              <ul className="choice-list" aria-label="Your answers">
                {model.choices.map((row, i) => (
                  <Answer key={row.id} row={row} first={i === firstEnabled} onChoose={onChoose} />
                ))}
              </ul>
            ) : model.canContinue ? (
              <div className="dialogue__continue">
                <Button variant="primary" data-autofocus="" className="dialogue__go" onClick={onContinue} aria-keyshortcuts="Enter">
                  {model.endsScene ? 'End the conversation' : 'Continue'}
                  <kbd aria-hidden="true">Enter</kbd>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <BacklogView lines={model.backlog} />
      </section>
    </RegionPalette>
  );
}

/** What is shown when the open scene is not in the pack (an old save): the only way out is the title. */
export function DialogueLostView({ canLeave, onTitle }: { canLeave: boolean; onTitle: () => void }): ReactNode {
  return (
    <section className="screen screen--dialogue dialogue dialogue--lost" data-screen="dialogue" aria-labelledby="dialogue-heading">
      <h1 id="dialogue-heading" tabIndex={-1}>
        The conversation has lost its thread
      </h1>
      <p>This conversation is not in the game’s world any more. Return to the title and load another save.</p>
      {canLeave ? (
        <Button variant="primary" data-autofocus="" onClick={onTitle}>
          Return to title
        </Button>
      ) : null}
    </section>
  );
}

export function DialogueScreen(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const model = useMemo(() => dialogueModel(state, content, profile, legal), [state, content, profile, legal]);
  const backdrop = useBackdrop(content.locations[state.world.currentLocationId], state.world.heartstone, content.locations);
  useViewFocus(rootRef, model === null ? 'lost' : `${model.sceneId}:${model.nodeId}`);

  const choose = (id: string): void => void store.dispatch({ type: 'choose', choiceId: id });
  const cont = (): void => void store.dispatch({ type: 'continue' });

  const move = (by: 1 | -1): void => {
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('.choice-btn, .dialogue__go') ?? [])];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[at < 0 ? (by > 0 ? 0 : items.length - 1) : (at + by + items.length) % items.length]?.focus();
  };
  const keys: HotkeyMap = {};
  model?.choices.forEach((row) => {
    if (row.key !== null && row.enabled) keys[row.key] = { run: () => choose(row.id), label: 'Take an answer by its number', group: 'action' };
  });
  if (model?.canContinue === true) {
    keys.enter = { run: cont, label: 'Continue', group: 'action' };
    keys.space = { run: cont, label: 'Continue', group: 'action', hidden: true };
  }
  if (model !== null && (model.choices.length > 1 || model.canContinue)) {
    keys.arrowup = { run: () => move(-1), label: 'Move between answers', group: 'list' };
    keys.arrowdown = { run: () => move(1), label: 'Move between answers', group: 'list' };
  }
  useHotkeys(keys, { scope: 'Conversation' });

  return (
    <div ref={rootRef} className="dialogue-root">
      {model === null ? (
        <DialogueLostView canLeave={store.isLegal({ type: 'returnToTitle' })} onTitle={() => void store.dispatch({ type: 'returnToTitle' })} />
      ) : (
        <DialogueView model={model} backdrop={backdrop} reducedMotion={reducedMotion} onChoose={choose} onContinue={cont} />
      )}
    </div>
  );
}
