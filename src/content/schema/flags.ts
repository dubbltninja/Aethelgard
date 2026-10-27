// Flags the engine sets by itself (C-58, D-090). The validator's rule 2 warns about a flag that content reads but nothing
// sets; these are set by engine code, so content may read them freely. Mirrored from the `FLAG_*` constants in src/engine
// (content cannot import the engine); tests/unit/content/engineFlags.test.ts keeps the two lists equal.
export const ENGINE_WRITTEN_FLAGS: readonly string[] = [
  'flag_brak_kept_away',
  'flag_clock_expired',
  'flag_conflux_anchored',
  'flag_cradle_pin_anchored',
  'flag_entered_before_via_apex',
  'flag_entered_before_via_nexus',
  'flag_horde_active',
  'flag_library_portal_open',
  'flag_tyrant_dead',
  'flag_tyrant_spared',
  'flag_tyrant_steadied',
  'flag_wanted_in_silverwood',
];
