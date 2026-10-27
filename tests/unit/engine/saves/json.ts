// Path-addressed edits of parsed JSON, for tampering with save files in tests (`set(file, 'state.player.hp', '40')`).
// Segments are split on dots; an array is addressed by index (`state.player.inventory.0.qty`).
export type Obj = Record<string, unknown>;

function parentOf(root: unknown, path: string): { parent: Obj; key: string } {
  const segments = path.split('.');
  const key = segments.pop() as string;
  let at: unknown = root;
  for (const seg of segments) {
    if (typeof at !== 'object' || at === null) throw new Error(`json: no object at '${seg}' of '${path}'`);
    at = (at as Obj)[seg];
  }
  if (typeof at !== 'object' || at === null) throw new Error(`json: no object holds '${key}' of '${path}'`);
  return { parent: at as Obj, key };
}

export function get(root: unknown, path: string): unknown {
  const { parent, key } = parentOf(root, path);
  return parent[key];
}

export function set(root: unknown, path: string, value: unknown): void {
  const { parent, key } = parentOf(root, path);
  parent[key] = value;
}

export function del(root: unknown, path: string): void {
  const { parent, key } = parentOf(root, path);
  delete parent[key];
}

/** The array at `path`, to push onto. */
export function list(root: unknown, path: string): unknown[] {
  const value = get(root, path);
  if (!Array.isArray(value)) throw new Error(`json: '${path}' is not an array`);
  return value;
}
