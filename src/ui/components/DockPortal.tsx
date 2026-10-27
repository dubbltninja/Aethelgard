// <DockPortal> (U73 part B): renders its children in the Shell's dock slot — the strip stuck to the bottom of the viewport,
// above the key legend — so a screen can pin a control bar there. The slot is found after the first commit (the dock is a
// sibling of the screen); until then nothing is drawn, so the bar never mounts twice. Without a slot (a unit test, no DOM)
// the children render in place, and the bar's own `position: sticky` still pins it.
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const DOCK_SLOT_ID = 'dock-slot';

const findSlot = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.getElementById(DOCK_SLOT_ID));

export function DockPortal({ children }: { children: ReactNode }): ReactNode {
  // undefined: not looked for yet (a DOM exists, the slot may be mounted by now); null: there is none
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(() => findSlot() ?? (typeof document === 'undefined' ? null : undefined));
  useLayoutEffect(() => {
    setSlot(findSlot());
  }, []);
  if (slot === undefined) return null;
  return slot === null ? children : createPortal(children, slot);
}
