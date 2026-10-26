// The phone action bar (U73 part B, D-130; DESIGN §16.5 mobile): pinned to the bottom of the viewport under 760 px so a turn
// never needs a scroll — Attack, Guard, Item, Flee (only when it is a choice) and Abilities, which opens the full grid as a
// sheet. Each button keeps the name and key it has on a desktop ("1: Attack, at the Shade", "G: Guard, …"); a button that
// cannot be used stays focusable with `aria-disabled`. Targets are at least 44 px; at large text the bar wraps to two rows.
// Pure.
import type { ReactNode } from 'react';
import { Icon, type IconKind } from '../../art/Icon';
import { tileName, type AbilityTileModel, type FleeModel, type GuardModel } from '../../screens/combatModel';
import { fleeName, guardName } from './PlayerPanel';
import { abilitiesName, type PhoneBarModel } from './phoneBarModel';

export interface PhoneBarProps {
  model: PhoneBarModel;
  targetName: string | null;
  guard: GuardModel;
  flee: FleeModel;
  itemCount: number;
  canItem: boolean;
  onAttack: (tile: AbilityTileModel) => void;
  onGuard: () => void;
  onFlee: () => void;
  onItems: () => void;
  onAbilities: () => void;
}

interface BarButtonProps {
  action: string;
  icon: IconKind;
  label: string;
  detail?: string | null;
  name: string;
  keys?: string | undefined;
  disabled: boolean;
  danger?: boolean;
  badge?: number;
  autoFocus?: boolean;
  onClick: () => void;
}

function BarButton({ action, icon, label, detail, name, keys, disabled, danger = false, badge, autoFocus = false, onClick }: BarButtonProps): ReactNode {
  return (
    <button
      type="button"
      className={danger ? 'phone-bar__btn phone-bar__btn--danger' : 'phone-bar__btn'}
      data-action={action}
      aria-label={name}
      aria-keyshortcuts={keys}
      aria-disabled={disabled ? 'true' : undefined}
      data-autofocus={autoFocus ? '' : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <Icon kind={icon} size={22} />
      <span className="phone-bar__label">{label}</span>
      {detail == null ? null : <span className="phone-bar__label">{detail}</span>}
      {badge === undefined || badge === 0 ? null : (
        <span className="phone-bar__badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}

export function PhoneBar({ model, targetName, guard, flee, itemCount, canItem, onAttack, onGuard, onFlee, onItems, onAbilities }: PhoneBarProps): ReactNode {
  const attack = model.attack;
  return (
    <div className="phone-bar" role="group" aria-label="Turn actions">
      {attack === null ? null : (
        <BarButton
          action="attack"
          icon="attack"
          label="Attack"
          name={tileName(attack, targetName)}
          keys={attack.key ?? undefined}
          disabled={!attack.enabled}
          autoFocus
          onClick={() => onAttack(attack)}
        />
      )}
      <BarButton action="guard" icon="guard" label="Guard" name={guardName(guard)} keys="G" disabled={!guard.enabled} onClick={onGuard} />
      <BarButton
        action="items"
        icon="item"
        label="Item"
        name={`I: Item, ${itemCount === 0 ? 'nothing you can use' : `${itemCount} you can use`}`}
        keys="I"
        disabled={!canItem}
        onClick={onItems}
      />
      {flee.shown ? (
        <BarButton action="flee" icon="flee" label={flee.leave ? 'Leave' : `Flee ${flee.chance}%`} detail={flee.reason} name={fleeName(flee)} keys="F" disabled={!flee.enabled} danger={flee.leave} onClick={onFlee} />
      ) : null}
      {model.abilities.length === 0 ? null : (
        <BarButton action="abilities" icon="ability" label="Abilities" name={abilitiesName(model)} disabled={false} badge={model.ready} onClick={onAbilities} />
      )}
    </div>
  );
}
