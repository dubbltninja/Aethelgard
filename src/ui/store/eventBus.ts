// A minimal synchronous emitter (PLAN §6.1): the store's change and event channels. A listener that unsubscribes
// (or subscribes another) while an emit is running does not disturb that emit.
export interface Emitter<A extends unknown[]> {
  on(listener: (...args: A) => void): () => void;
  emit(...args: A): void;
  size(): number;
}

export function createEmitter<A extends unknown[]>(): Emitter<A> {
  const listeners = new Set<(...args: A) => void>();
  return {
    on(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit(...args) {
      for (const listener of [...listeners]) listener(...args);
    },
    size: () => listeners.size,
  };
}
