export type AnomalyId =
  | 'dimensional_rift' | 'mirror_rift' | 'gravelord' | 'avarice'
  | 'clockwork_judge' | 'old_friend' | 'hungering_dark' | 'the_hunter'
  | 'wandering_merchant' | 'cursed_bargain' | 'gamblers_chest'
  | 'caged_ally' | 'blood_moon' | 'echo_fallen_hero' | 'beast_stampede';

export interface AnomalyDef {
  id: AnomalyId;
  name: string;
  whisper: string;
  weight: number;
  minFloor: number;
  maxFloor: number;
}

export const ANOMALY_DEFS: AnomalyDef[] = [
  {
    id: 'dimensional_rift', name: 'Dimensional Rift',
    whisper: 'Reality tears... something bleeds through.',
    weight: 3, minFloor: 2, maxFloor: 10,
  },
  {
    id: 'mirror_rift', name: 'Mirror Rift',
    whisper: 'Your shadow stirs... it turns to face you.',
    weight: 4, minFloor: 1, maxFloor: 10,
  },
  {
    id: 'gravelord', name: 'The Gravelord',
    whisper: 'Candles burn where none were lit...',
    weight: 3, minFloor: 3, maxFloor: 10,
  },
  {
    id: 'avarice', name: 'Avarice, the Gilded Maw',
    whisper: 'Greed calls to greed... count your coins carefully.',
    weight: 4, minFloor: 2, maxFloor: 10,
  },
  {
    id: 'clockwork_judge', name: 'The Clockwork Judge',
    whisper: 'Perfection is demanded. Falter and be judged.',
    weight: 3, minFloor: 4, maxFloor: 10,
  },
  {
    id: 'old_friend', name: 'Old Friend',
    whisper: 'Pages scattered in the dark... someone remembers you.',
    weight: 3, minFloor: 3, maxFloor: 10,
  },
  {
    id: 'hungering_dark', name: 'The Hungering Dark',
    whisper: 'The torches die. Something watches from the black.',
    weight: 4, minFloor: 1, maxFloor: 10,
  },
  {
    id: 'the_hunter', name: 'The Hunter',
    whisper: 'You are being followed. It knows where you sleep.',
    weight: 3, minFloor: 2, maxFloor: 10,
  },
  {
    id: 'wandering_merchant', name: 'Wandering Merchant',
    whisper: 'A lantern flickers where there was only stone...',
    weight: 5, minFloor: 1, maxFloor: 10,
  },
  {
    id: 'cursed_bargain', name: 'Cursed Bargain',
    whisper: 'A shrine with no god. The price is steep.',
    weight: 4, minFloor: 2, maxFloor: 10,
  },
  {
    id: 'gamblers_chest', name: "Gambler's Chest",
    whisper: 'A chest with blood on the lock. Risk or reward?',
    weight: 5, minFloor: 1, maxFloor: 10,
  },
  {
    id: 'caged_ally', name: 'Caged Ally',
    whisper: 'Someone still breathes in the dark. They need you.',
    weight: 4, minFloor: 1, maxFloor: 10,
  },
  {
    id: 'blood_moon', name: 'Blood Moon',
    whisper: 'The moon is wrong tonight. Everything is angry.',
    weight: 4, minFloor: 2, maxFloor: 10,
  },
  {
    id: 'echo_fallen_hero', name: 'Echo of a Fallen Hero',
    whisper: 'A ghost wearing your face fights for what you lost.',
    weight: 3, minFloor: 3, maxFloor: 10,
  },
  {
    id: 'beast_stampede', name: 'Beast Stampede',
    whisper: 'Pounding. Distant at first. Getting closer.',
    weight: 4, minFloor: 1, maxFloor: 10,
  },
];

/** Roll which anomaly (if any) activates this floor. */
export function rollAnomaly(floor: number, rng: () => number): AnomalyId | null {
  if (rng() > 0.22) return null;
  const eligible = ANOMALY_DEFS.filter(a => floor >= a.minFloor && floor <= a.maxFloor);
  if (eligible.length === 0) return null;
  const total = eligible.reduce((s, a) => s + a.weight, 0);
  let roll = rng() * total;
  for (const a of eligible) {
    roll -= a.weight;
    if (roll <= 0) return a.id;
  }
  return eligible[eligible.length - 1].id;
}
