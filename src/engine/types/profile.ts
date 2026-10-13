// Profile (PLAN §4.3): the persistent layer that survives every loop and deleting a run (D-034). JSON-serializable
// like GameState. `step` takes and returns it (D-041); reducers write it through `ctx.profileDraft()`.
import type { CloserReason } from './ids';

export interface Settings {
  textScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  /** 0..1 each. */
  volumes: { master: number; ambient: number; sfx: number; music: number };
  muted: boolean;
  autosave: boolean;
  /** Show exact telegraphed damage. */
  showIntentNumbers: boolean;
  confirmFlee: boolean;
  logLength: 50 | 100 | 200;
}

export interface RunRecord {
  runId: string;
  seed: string;
  loop: number;
  classId: string;
  /** EndingId (`ending_*`) or `closer_escape` / `closer_fall`. */
  outcome: string;
  reason?: CloserReason;
  daysUsed: number;
  level: number;
  echoesGained: string[];
  questsCompleted: string[];
  tyrant: 'defeated' | 'spared' | 'untouched';
  heartstone: string;
  modifiers: string[];
  /** One-line Threshold text. */
  summary: string;
}

export interface BestiaryEntry {
  seen: number;
  killed: number;
  spared: number;
  revealed: 'none' | 'resist' | 'pattern' | 'all';
  intentsSeen: string[];
}

export interface AchievementRecord {
  loop: number;
  day: number;
  runId: string;
}

export interface ClassMastery {
  loopsPlayed: number;
  /** Abilities whose half-point cost is halved (DESIGN §5). */
  mastered: string[];
  endings: string[];
  /** Highest level reached with this class; the carry-over start level reads the max over classes (D-067.2, D-070.5). */
  bestLevel: number;
  bestDays: number | null;
}

export interface Profile {
  version: number;
  /** Set by the shell from a counter persisted in the profile; not a clock. */
  profileId: string;
  echoes: string[];
  codexUnlocked: string[];
  bestiary: Record<string, BestiaryEntry>;
  achievements: Record<string, AchievementRecord>;
  resonance: number;
  resonanceEarnedTotal: number;
  /** Equip cap 5 (DESIGN §10.7, D-011); no ranks. */
  attunements: { owned: string[]; equipped: string[] };
  classMastery: Record<string, ClassMastery>;
  /** Capped at 200. */
  runHistory: RunRecord[];
  settings: Settings;
  /** Toggles for the *next* loop (D-021). */
  modifiers: Record<string, boolean>;
  /** LocationIds ever discovered (greyed "remembered" nodes, D-011). */
  mapKnowledge: string[];
  /** First-time discovery keys that already paid Resonance ('loc:x', 'kill:y', 'item:z', 'echo:e', 'quest:q'). */
  discoveries: string[];
  endingsReached: string[];
  /** endLoop sets max(profile, run) + 1 (DESIGN §10.3). */
  loopCounter: number;
  /** How many NG+ starts. */
  newGamePlus: number;
  lastClassId: string | null;
}
