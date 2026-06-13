import { PHYS_CHART, ELEM_CHART } from '../config';
import type { PhysType, BodyType, ElemFamily, Hitzone } from '../types';
import type { GameElement } from '../config';

export type HitLabel = 'WEAK' | 'RESIST' | 'ABSORB' | 'IMMUNE' | null;

export interface HitResult {
  finalDmg: number;   // negative = heal (absorb)
  label: HitLabel;
}

/**
 * Resolves physical + elemental damage modifiers from affinity charts.
 *
 * baseDmg    — raw output from computeAttackDamage / spell formula (post-crit)
 * physType   — weapon's physical category (slash/blunt/pierce)
 * element    — 'none' for purely physical; a GameElement for spells/coatings
 * body       — target's body type (optional; skips phys chart if absent)
 * elemFamily — target's element family (optional; skips elem chart if absent)
 * hitzone    — optional targeted body part modifiers (boss hitzones)
 */
export function resolveHit(
  baseDmg: number,
  physType: PhysType,
  element: 'none' | GameElement,
  body?: BodyType,
  elemFamily?: ElemFamily,
  hitzone?: Hitzone,
): HitResult {
  // ── Physical component ──────────────────────────────────────────────────────
  const physMult   = body ? PHYS_CHART[body][physType] : 1.0;
  const hzRawMod   = hitzone?.rawMod  ?? 1.0;
  const hzElemMod  = hitzone?.elemMod ?? 1.0;

  // ── Elemental component ─────────────────────────────────────────────────────
  let elemMult = 1.0;
  if (element !== 'none' && elemFamily) {
    const chart = ELEM_CHART[elemFamily];
    elemMult = chart[element] ?? 1.0;
  }

  // ── Damage split ────────────────────────────────────────────────────────────
  // Pure physical: all damage goes through physMult × hitzone rawMod.
  // Elemental hit: 25% phys + 75% elemental (elem bypasses body-type DR).
  // ±3% random variance applied at the end.
  const variance = 0.97 + Math.random() * 0.06;
  let finalDmg: number;
  if (element === 'none') {
    finalDmg = Math.round(baseDmg * physMult * hzRawMod * variance);
  } else {
    const physPart = baseDmg * 0.25 * physMult * hzRawMod;
    const elemPart = baseDmg * 0.75 * elemMult * hzElemMod;
    finalDmg = Math.round((physPart + elemPart) * variance);
  }

  // ── Label ───────────────────────────────────────────────────────────────────
  let label: HitLabel = null;
  if (element !== 'none' && elemFamily) {
    const eff = ELEM_CHART[elemFamily][element] ?? 1.0;
    if (eff < 0)         label = 'ABSORB';
    else if (eff === 0)  label = 'IMMUNE';
    else if (eff >= 1.5) label = 'WEAK';
    else if (eff <= 0.75) label = 'RESIST';
  }

  return { finalDmg, label };
}
