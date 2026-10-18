// Bootstrap (PLAN §6.1): the content pack, the browser storage, the profile and the store, ready for <App/>.
// The pack is validated at build time (`npm run validate` runs before every build), so production skips the
// cross-reference pass at startup; dev builds run it and fail loudly.
import { buildContentPack, contentTables, type ContentPack } from '@content/index';
import type { StoragePort } from '@engine/index';
import { createGameStore, type GameStore } from './store/gameStore';
import { browserStorage, loadProfile, saveProfile } from './store/persistence';

export interface Booted {
  store: GameStore;
  content: ContentPack;
}

export interface BootOptions {
  content?: ContentPack;
  /** Default: the page's localStorage (null if the browser blocks it). */
  storage?: StoragePort | null;
}

export function bootGame(opts: BootOptions = {}): Booted {
  const content = opts.content ?? buildContentPack(contentTables, __DEV__ ? {} : { validate: false });
  const storage = opts.storage === undefined ? browserStorage() : opts.storage;
  const loaded = loadProfile(storage);
  const store = createGameStore(content, loaded.profile, { storage });
  // A first visit writes its profile at once, so the profile id (the seed of every later loop) sticks.
  if (storage !== null && loaded.fresh) saveProfile(storage, loaded.profile);
  if (loaded.problem !== null) store.notify(loaded.problem, 'error');
  if (storage === null) store.notify('This browser keeps no data for this page, so you can play but nothing will be saved.', 'info');
  return { store, content };
}
