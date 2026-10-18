// A DOM-free way to "interact" with pure views (PLAN §8.3: jsdom and Testing Library are unavailable, D-065).
// Views take props only and use no hooks, so a view's element tree can be expanded by calling its function
// components directly; the intrinsic elements that come out keep their props, so a test can find a button by its
// accessible name and call its `onClick`, or a field and call its `onChange`. Real browser interaction is e2e's job.
import type { ReactNode } from 'react';

export interface Node {
  type: string;
  props: Record<string, unknown>;
  /** Intrinsic ancestors, nearest first. */
  ancestors: Node[];
  children: Node[];
  /** Text inside this element (aria-hidden subtrees excluded). */
  text: string;
}

interface ElementLike {
  type: unknown;
  props: Record<string, unknown>;
}

function isElement(value: unknown): value is ElementLike {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value;
}

/** Expands `node` into intrinsic elements in document order. */
export function expand(node: ReactNode): Node[] {
  const out: Node[] = [];
  walk(node, [], out);
  return out;
}

function walk(node: unknown, ancestors: Node[], out: Node[]): { nodes: Node[]; text: string } {
  if (node === null || node === undefined || typeof node === 'boolean') return { nodes: [], text: '' };
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return { nodes: [], text: String(node) };
  if (Array.isArray(node)) {
    const nodes: Node[] = [];
    let text = '';
    for (const child of node) {
      const r = walk(child, ancestors, out);
      nodes.push(...r.nodes);
      text += r.text;
    }
    return { nodes, text };
  }
  if (!isElement(node)) return { nodes: [], text: '' };
  if (typeof node.type === 'function') return walk((node.type as (p: unknown) => unknown)(node.props), ancestors, out);
  if (typeof node.type !== 'string') return walk(node.props.children, ancestors, out); // Fragment, context providers
  const self: Node = { type: node.type, props: node.props, ancestors, children: [], text: '' };
  out.push(self);
  const inner = walk(node.props.children, [self, ...ancestors], out);
  self.children = inner.nodes;
  const hidden = node.props['aria-hidden'] === 'true' || node.props['aria-hidden'] === true;
  self.text = hidden ? '' : inner.text;
  return { nodes: [self], text: self.text };
}

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The accessible name: aria-label, else the text (an input: aria-label, else its wrapping <label>'s text). */
export function nameOf(node: Node): string {
  const label = node.props['aria-label'];
  if (typeof label === 'string') return squash(label);
  if (node.type === 'input' || node.type === 'select' || node.type === 'textarea') {
    const wrapping = node.ancestors.find((a) => a.type === 'label');
    return wrapping === undefined ? '' : squash(wrapping.text);
  }
  return squash(node.text);
}

export function all(nodes: readonly Node[], type: string): Node[] {
  return nodes.filter((n) => n.type === type);
}

export function byName(nodes: readonly Node[], type: string, name: string | RegExp): Node {
  const found = nodes.filter((n) => n.type === type && (typeof name === 'string' ? nameOf(n) === name : name.test(nameOf(n))));
  if (found.length !== 1) {
    const names = all(nodes, type).map(nameOf);
    throw new Error(`expected one <${type}> named ${String(name)}, found ${found.length} among: ${JSON.stringify(names)}`);
  }
  return found[0] as Node;
}

/** A synthetic event good enough for handlers that read `target.value` / call `preventDefault`. */
export function fakeEvent(target: Record<string, unknown> = {}): { target: Record<string, unknown>; preventDefault: () => void; prevented: () => boolean } {
  let prevented = false;
  return {
    target,
    preventDefault: () => {
      prevented = true;
    },
    prevented: () => prevented,
  };
}

export function call(node: Node, handler: string, event: unknown = fakeEvent()): void {
  const fn = node.props[handler];
  if (typeof fn !== 'function') throw new Error(`<${node.type}> "${nameOf(node)}" has no ${handler}`);
  (fn as (e: unknown) => void)(event);
}
