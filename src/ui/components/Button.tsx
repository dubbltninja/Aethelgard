// The one button (PLAN §6.7): always a real <button>, `type="button"` unless told otherwise, at least 44 × 44 px
// (components.css), with a visible focus ring from the tokens. Variants: primary (one per view), secondary, quiet.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps): ReactNode {
  return <button type={type} className={cx('btn', `btn--${variant}`, className)} {...rest} />;
}
