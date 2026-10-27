// The Achievements panel (DESIGN §15.2, §16.3 `screen_achievements`; opened from the Title menu and the Gallery; U68): forty
// badges in a grid — an earned one with its name, its words and the loop and day it came; one still ahead with its condition
// and, where the condition is a count, how far along it is; a hidden one as "???" until it is earned. State is never carried
// by colour alone: each badge says Earned, In progress or Hidden in words.
//
// Pattern (D-104): `AchievementsPanel` holds the hooks; `AchievementsView` takes a model only.
import type { ReactNode } from 'react';
import { useContent, useGame, useProfile } from '../store/useGame';
import { achievementsModel, type AchievementRow, type AchievementsModel } from './achievementsModel';

function statusWord(r: AchievementRow): string {
  if (r.earned) return 'Earned';
  return r.hidden ? 'Hidden' : 'Not yet';
}

function Badge({ row }: { row: AchievementRow }): ReactNode {
  return (
    <li className="badge" data-earned={row.earned ? 'true' : 'false'} data-hidden={row.hidden && !row.earned ? 'true' : 'false'} data-achievement={row.id}>
      <span className="badge__mark" aria-hidden="true">
        {row.earned ? '★' : row.hidden ? '?' : '☆'}
      </span>
      <div className="badge__text">
        <h3 className="badge__name">{row.name}</h3>
        <p className="badge__desc">{row.description}</p>
        <p className="badge__status">
          {statusWord(row)}
          {row.when === null ? null : ` · ${row.when}`}
        </p>
        {row.progress === null ? null : (
          <p className="badge__progress">
            <span
              className="badge__meter"
              role="meter"
              aria-label={`${row.name} progress`}
              aria-valuemin={0}
              aria-valuemax={row.progress.need}
              aria-valuenow={row.progress.have}
              aria-valuetext={`${row.progress.have} of ${row.progress.need}${row.progress.unit === '' ? '' : ` ${row.progress.unit}`}`}
            >
              <span className="badge__fill" style={{ width: `${Math.round((row.progress.have / row.progress.need) * 100)}%` }} />
            </span>
            <span className="badge__count">
              {row.progress.have} of {row.progress.need}
              {row.progress.unit === '' ? '' : ` ${row.progress.unit}`}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}

export function AchievementsView({ model }: { model: AchievementsModel }): ReactNode {
  return (
    <div className="lore-panel achievements">
      <div className="panel-bar">
        <span className="panel-bar__chip" data-testid="achievements-count">
          {model.earned} of {model.total} earned
        </span>
      </div>
      {model.rows.length === 0 ? (
        <p className="lore__empty" data-autofocus="" tabIndex={-1}>
          This game has no achievements.
        </p>
      ) : (
        <ul className="badges" aria-label="Achievements" data-autofocus="" tabIndex={-1}>
          {model.rows.map((r) => (
            <Badge key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function AchievementsPanel(): ReactNode {
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  return <AchievementsView model={achievementsModel(state, content, profile)} />;
}
