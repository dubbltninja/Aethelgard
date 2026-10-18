// The modal frame every panel and dialog uses (PLAN §6.7): `role="dialog"` (or `alertdialog`) with `aria-modal`, a
// heading that names it, focus moved in and trapped, Esc and a Close button to leave, focus returned to the opener.
// Its Esc binding is a modal hotkey layer, so screen keys underneath stop while it is open.
import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useHotkeys, type HotkeyLevel } from '../hooks/useHotkeys';
import { Button, cx } from './Button';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  /** Panels sit at `panel`; a confirm over a panel sits at `dialog`. */
  level?: HotkeyLevel;
  className?: string;
  /** Hide the header's Close button (a dialog whose own buttons close it). */
  hideClose?: boolean;
}

export function Modal({ title, onClose, children, role = 'dialog', level = 'panel', className, hideClose = false }: ModalProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref);
  useHotkeys({ escape: { run: onClose, label: 'Close', group: 'system' } }, { scope: title, level, modal: true });
  return (
    <div className="modal-backdrop">
      <div ref={ref} className={cx('modal', className)} role={role} aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {hideClose ? null : (
            <Button variant="quiet" className="modal__close" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
              Close
            </Button>
          )}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
