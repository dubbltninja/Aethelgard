// The `save` and `load` actions (PLAN §4.6/§4.7, §4.12). The engine does no I/O: `save` emits `saveRequested` and the
// shell serializes the post-step state; `load` validates and migrates the file the shell parsed, then replaces the
// state wholesale, as if the game had never been closed.
import type { StepCtx } from '../ctx';
import type { Enumerator } from '../legalActions';
import type { ActionOf } from '../types/actions';
import type { Mode } from '../types/state';
import { canAutosave } from './autosave';
import { MANUAL_SLOTS, isSaveSlot } from './keys';
import { SAVE_VERSION, deserialize } from './saveFile';

/** Modes a save can resume into (title → explore | threshold, MODE_TRANSITIONS). */
const RESUMABLE: readonly Mode[] = ['explore', 'threshold'];

/** `save`: manual slots 1–3 any time the mode allows; the autosave slot only where `canAutosave` does (D-067.1). */
export function saveHandler(ctx: StepCtx, action: ActionOf<'save'>): void {
  if (!isSaveSlot(action.slot)) ctx.reject(`'${String(action.slot)}' is not a save slot`);
  if (action.slot === 'auto' && !canAutosave(ctx.s)) ctx.reject('the autosave slot is not written here (combat, a Horde, or the Loop 1 Apex)');
  ctx.emit({ t: 'saveRequested', slot: action.slot });
}

/**
 * `load`: `action.save` is the parsed file. Invalid files are rejected with the readable error. The loaded state is
 * exactly the saved one — `step` counts every accepted action, so the step counter is set one below the saved value
 * and ends equal to it; Resume plus the same actions then replays the original run.
 */
export function loadHandler(ctx: StepCtx, action: ActionOf<'load'>): void {
  const loaded = deserialize(action.save, ctx.content);
  if ('error' in loaded) ctx.reject(`load: ${loaded.error}`);
  const { state } = loaded;
  if (!RESUMABLE.includes(state.mode)) ctx.reject(`load: this save was made in ${state.mode} mode and cannot be resumed`);
  const from = ctx.s.mode;
  const draft = ctx.s as unknown as Record<string, unknown>;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, state);
  ctx.s.meta.stepCount -= 1;
  ctx.emit({ t: 'modeChanged', from, to: state.mode });
  ctx.emit({ t: 'saveLoaded', version: SAVE_VERSION, migratedFrom: loaded.migratedFrom });
  for (const text of loaded.warnings) ctx.emit({ t: 'log', text: `Save: ${text}.`, kind: 'system' });
}

/** `save` is listed for slots 1–3 (and `auto` where it may be written); `load` carries a payload and is never listed. */
export const saveEnumerator: Enumerator<'save'> = (state) => [
  ...MANUAL_SLOTS.map((slot) => ({ type: 'save' as const, slot })),
  ...(canAutosave(state) ? [{ type: 'save' as const, slot: 'auto' as const }] : []),
];
