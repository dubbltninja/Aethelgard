// The Breach overlay's intensity (DESIGN §17.2 `SceneSpec.breachOverlay?: 0..1`, §10.2 "the sky tears above the Apex"; U70).
// U70 supplies the value only — U71's scene system draws it. It is a pure function of the clock and the Horde, so it changes
// only when a day does (§17.7: "The Breach overlay animates only on day change"): nothing at more than five dawns, then a
// faint tinge that thickens by a step per dawn, the Horde's own level once it runs, and the heaviest on an infected place.
import { dawnsLeft } from '@engine/index';

export interface BreachInput {
  clock: { ticks: number; limitTicks: number; expired: boolean };
  hordeActive: boolean;
  /** The Horde has reached the place the scene shows. */
  infected: boolean;
}

/** The Fall forecast starts this many dawns before the limit (mapModel `FORECAST_DAWNS`). */
const RAMP_DAWNS = 5;
export const HORDE_LEVEL = 0.22;
export const INFECTED_LEVEL = 0.55;
/** One dawn closer adds this much (5 dawns left = one step, 1 dawn left = five). */
export const RAMP_STEP = 0.035;

/** 0..1: how much of the Breach to draw over a scene. */
export function breachOverlay(input: BreachInput): number {
  if (input.infected) return INFECTED_LEVEL;
  if (input.hordeActive || input.clock.expired) return HORDE_LEVEL;
  const dawns = dawnsLeft(input.clock);
  if (dawns > RAMP_DAWNS) return 0;
  return Math.round(Math.max(0, RAMP_DAWNS + 1 - Math.max(1, dawns)) * RAMP_STEP * 1000) / 1000;
}
