# Monsters

> Source: `src/data/enemies.ts`, `src/entities/Enemy.ts`, `src/config.ts`

All enemies share the same core AI but vary in stats and behaviour. Difficulty scales naturally with floor depth.

---

## AI Overview

Every enemy has three states:

| State | Trigger | Behaviour |
|---|---|---|
| **Idle** | Nothing detected | Wanders slowly (~30% of normal speed), occasionally stops |
| **Chase** | Player detected | Moves directly toward player at full speed |
| **Attack** | Within 36 px (~1 tile) of player | Stops, hits for `dmg` every 900 ms |

### Detection rules

| Condition | Range | Notes |
|---|---|---|
| Sight | 160 px (5 tiles) | Always active |
| Hearing | 360 px (11 tiles) | **Only triggers while the player is moving.** Works through walls and pillars. |
| Alarm trap | Triple sight range | Persists for 8 seconds after being triggered |

> **Lurkers** ignore all of the above until the player is within 3.5 tiles — then they sprint at 1.6× speed for 2.8 s. 35% of goblin group members spawn as lurkers.

### Invincibility frames
The player has **450 ms** of invincibility after being hit. Enemies do not have iframes — melee hits all enemies in range simultaneously.

---

## Goblin Theme (Floor 1+)

Floor 1 is heavily goblin-populated. Goblins cluster near **warp pads** (2nd-floor gates). Cave creatures occupy the unexplored depths away from the gates.

### Goblin
> Small, fast, vicious. Travels in groups of 1–3.

| Stat | Value |
|---|---|
| HP | 55 |
| Damage | 16 per hit |
| Speed | 68 px/s |
| Gold drop | 2–6 |
| First appears | Floor 1 |

**Sprite:** Green skin, rusty skullcap, corroded shortsword at hip, bare feet with toe nubs.  
**Lurker chance:** 35% per spawn in a goblin group.

---

### Goblin Shaman
> Fragile but hits harder. Avoided by low-HP characters at range.

| Stat | Value |
|---|---|
| HP | 42 |
| Damage | 24 per hit |
| Speed | 52 px/s |
| Gold drop | 4–10 |
| First appears | Floor 1 |

**Sprite:** Tall bone-skull hat, glowing arcane green eyes, rune-marked robe, orb staff.  
**Note:** Same melee-only AI as warrior goblin; the higher damage punishes players who let them approach.

---

## Cave Creatures

### Cave Bat
> Fastest enemy in the game. Rushes directly through corridors.

| Stat | Value |
|---|---|
| HP | 26 |
| Damage | 12 per hit |
| Speed | 80 px/s |
| Gold drop | 1–3 |
| First appears | Floor 1 |

**Sprite:** Spread wings, tiny body, red glowing eyes, ear spikes.  
**Threat:** High speed combined with hearing range means bats will reach you before you see them if you're moving.

---

### Rock Spider
> Medium threat. Appears in groups if bats are present on the same floor.

| Stat | Value |
|---|---|
| HP | 58 |
| Damage | 20 per hit |
| Speed | 62 px/s |
| Gold drop | 2–5 |
| First appears | Floor 2 |

**Sprite:** Large round abdomen, 4 visible leg pairs, 6 red eyes, mandibles.

---

### Skeleton
> Moderate speed, heavy damage. Armed with a rusty sword.

| Stat | Value |
|---|---|
| HP | 95 |
| Damage | 28 per hit |
| Speed | 55 px/s |
| Gold drop | 3–9 |
| First appears | Floor 3 |

**Sprite:** Hollow eye sockets, visible ribcage, arm bones, rusty sword in right hand.  
**Threat:** Single hit from a skeleton is ~30% of a Sage's starting HP.

---

### Stone Golem
> Slow but nearly unkillable. High damage — do not let it close the distance.

| Stat | Value |
|---|---|
| HP | 210 |
| Damage | 38 per hit |
| Speed | 36 px/s |
| Gold drop | 6–16 |
| First appears | Floor 5 |

**Sprite:** Square stone head, orange glowing eyes, slab body, heavy fists.  
**Counter:** Use pillars and corridor chokepoints to attack safely at range, or sprint past it.

---

### Cave Troll
> Dangerous at all ranges. Fast for its size.

| Stat | Value |
|---|---|
| HP | 145 |
| Damage | 46 per hit |
| Speed | 56 px/s |
| Gold drop | 8–22 |
| First appears | Floor 7 |

**Sprite:** Boar tusks, yellow eyes, knuckle-dragging arms, club weapon, thick green legs.  
**Threat:** One hit kills most characters below level 3 on HP-weak builds (Sage, Assassin).

---

## Ambient Spawning

Every **22 seconds**, 1–3 enemies spawn **outside the player's field of view** at a random floor tile 8–22 tiles from the player. This means the dungeon is never safe to stand still in.

- Floors 1–3: goblins are the ambient spawn pool
- Floors 4+: full enemy pool for that floor

Spawned enemies follow the same detection rules as placed enemies. Since they appear outside your FOV they will approach from darkness.

---

## Encounter tips

| Situation | Advice |
|---|---|
| Multiple goblins near a warp pad | Attack from a corridor — they can't all reach you at once |
| Lurker springs from behind a pillar | Sprint away, then ranged attack if possible |
| Moving down a long corridor | Stop periodically — walking broadcasts hearing-range to all enemies |
| Stone Golem blocking a warp | It is slow; circle it using a pillar as cover |
| Cave Bat + dim corridor | Slow to a creep before entering; bats hear 11 tiles while you move |
