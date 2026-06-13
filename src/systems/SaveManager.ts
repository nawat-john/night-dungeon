import { getSupabase } from '../lib/supabase';
import { CharacterSave, RunHistoryEntry, AccountMeta, SAVE_VERSION } from '../types';

const LOCAL_KEY         = 'nd_save_v1';
const PLAYER_ID_KEY     = 'nd_player_id';
const ACCOUNT_META_KEY  = 'nd_account_meta';

// ── Debounced server write ────────────────────────────────────────────────────
let _pendingSave: CharacterSave | null = null;
let _debounceHandle: ReturnType<typeof setTimeout> | null = null;

function schedulePush(save: CharacterSave): void {
  _pendingSave = save;
  if (_debounceHandle) clearTimeout(_debounceHandle);
  _debounceHandle = setTimeout(async () => {
    if (_pendingSave) await pushNow(_pendingSave).catch(() => undefined);
    _pendingSave    = null;
    _debounceHandle = null;
  }, 2000);
}

async function pushNow(save: CharacterSave): Promise<void> {
  const sb  = getSupabase();
  const pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!sb || !pid) return;
  await sb.from('saves').upsert({
    ip_address: pid,
    data:       save,
    updated_at: new Date().toISOString(),
  });
}

async function deleteNow(): Promise<void> {
  const sb  = getSupabase();
  const pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!sb || !pid) return;
  await sb.from('saves').delete().eq('ip_address', pid);
}

// ── Player identifier (public IP → fallback UUID) ─────────────────────────────
async function resolvePlayerId(): Promise<void> {
  if (localStorage.getItem(PLAYER_ID_KEY)) return;
  try {
    const ctrl = new AbortController();
    const tmo  = setTimeout(() => ctrl.abort(), 4000);
    const res  = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    clearTimeout(tmo);
    const { ip } = (await res.json()) as { ip: string };
    localStorage.setItem(PLAYER_ID_KEY, ip);
  } catch {
    localStorage.setItem(PLAYER_ID_KEY, crypto.randomUUID());
  }
}

// ── Initial server sync ───────────────────────────────────────────────────────
async function syncFromServer(): Promise<void> {
  const sb  = getSupabase();
  const pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!sb || !pid) return;
  try {
    const { data } = await sb
      .from('saves')
      .select('data')
      .eq('ip_address', pid)
      .maybeSingle();
    if (data?.data) {
      // Server record is authoritative — overwrite local cache
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data.data));
    }
  } catch {
    // Offline or config missing — fall through to localStorage
  }
}

/**
 * Call once at game startup (BootScene).
 * Resolves the player identifier then pulls the latest save from Supabase.
 * Gracefully degrades to localStorage if Supabase isn't configured or offline.
 */
export async function initSaveManager(): Promise<void> {
  await resolvePlayerId();
  await syncFromServer();
}

// ── Public synchronous API (reads/writes local cache; server syncs async) ─────
export class SaveManager {
  static load(): CharacterSave | null {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const save = JSON.parse(raw) as CharacterSave;
      return SaveManager.migrate(save);
    } catch {
      return null;
    }
  }

  /** Applies forward migrations so old saves always load cleanly. */
  private static migrate(save: CharacterSave): CharacterSave {
    // v1 → v2: add V2 optional fields with safe defaults
    if ((save.version ?? 1) < 2) {
      save.specialization  = save.specialization  ?? undefined;
      save.hunterState     = save.hunterState     ?? undefined;
      save.activeTonic     = save.activeTonic     ?? undefined;
      save.weaponInfusions = save.weaponInfusions ?? undefined;
      save.runModifiers    = save.runModifiers    ?? [];
      save.glass           = save.glass           ?? false;
      save.wrongfooted     = save.wrongfooted     ?? false;
      save.version = 2;
    }
    // Clamp to current version
    save.version = SAVE_VERSION;
    return save;
  }

  /** Writes to localStorage immediately; syncs to Supabase after a 2 s debounce. */
  static write(save: CharacterSave): void {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(save));
    schedulePush(save);
  }

  /** Deletes locally and on the server (fire-and-forget). */
  static wipe(): void {
    if (_debounceHandle) { clearTimeout(_debounceHandle); _debounceHandle = null; }
    _pendingSave = null;
    localStorage.removeItem(LOCAL_KEY);
    deleteNow().catch(() => undefined);
  }

  static hasSave(): boolean {
    return localStorage.getItem(LOCAL_KEY) !== null;
  }

  /** Returns the resolved player identifier (IP or UUID). */
  static getPlayerId(): string {
    return localStorage.getItem(PLAYER_ID_KEY) ?? 'unknown';
  }

  // ── Account meta (never wiped on permadeath) ─────────────────────────────────

  static loadAccountMeta(): AccountMeta {
    const defaults: AccountMeta = {
      runHistory: [], hallOfChampions: [], unlockedCheckpointFloors: [],
      research: [], masteries: [], unlockedRecipes: [], discoveredClues: [],
    };
    try {
      const raw = localStorage.getItem(ACCOUNT_META_KEY);
      if (!raw) return defaults;
      const meta = JSON.parse(raw) as AccountMeta;
      // Forward-fill new P10 fields onto older saves
      if (!meta.research)        meta.research        = [];
      if (!meta.masteries)       meta.masteries       = [];
      if (!meta.unlockedRecipes) meta.unlockedRecipes = [];
      if (!meta.discoveredClues) meta.discoveredClues = [];
      return meta;
    } catch {
      return defaults;
    }
  }

  static writeAccountMeta(meta: AccountMeta): void {
    localStorage.setItem(ACCOUNT_META_KEY, JSON.stringify(meta));
  }

  static appendRunHistory(entry: RunHistoryEntry): void {
    const meta = this.loadAccountMeta();
    entry.runNumber = (meta.runHistory[meta.runHistory.length - 1]?.runNumber ?? 0) + 1;
    meta.runHistory.push(entry);
    if (entry.victory) meta.hallOfChampions.push(entry);
    if (meta.runHistory.length > 50) meta.runHistory = meta.runHistory.slice(-50);
    this.writeAccountMeta(meta);
  }

  static unlockCheckpointFloor(floor: number): void {
    if (floor < 2 || floor > 10) return;
    const meta = this.loadAccountMeta();
    if (!meta.unlockedCheckpointFloors.includes(floor)) {
      meta.unlockedCheckpointFloors.push(floor);
      meta.unlockedCheckpointFloors.sort((a, b) => a - b);
      this.writeAccountMeta(meta);
    }
  }

  /** Call on victory: increments ascension tier and returns the new tier. */
  static incrementAscensionTier(): number {
    const meta = this.loadAccountMeta();
    meta.ascensionTier = (meta.ascensionTier ?? 0) + 1;
    this.writeAccountMeta(meta);
    return meta.ascensionTier;
  }

  /** Returns the current ascension tier (0 = no victory yet). */
  static getAscensionTier(): number {
    return this.loadAccountMeta().ascensionTier ?? 0;
  }

  // ── §P11 Weapon Mastery ───────────────────────────────────────────

  /** Mastery level thresholds (cumulative uses per weapon family). */
  static readonly MASTERY_THRESHOLDS = [10, 30, 70, 150, 300];

  /** Increment use count for a weapon family and persist. Returns new level (0–5). */
  static updateMastery(family: string): number {
    const meta = this.loadAccountMeta();
    if (!meta.masteries) {
      meta.masteries = [];
    }
    let entry = meta.masteries.find(m => m.family === family);
    if (!entry) {
      entry = { family, level: 0, uses: 0 };
      meta.masteries.push(entry);
    }
    entry.uses = (entry.uses ?? 0) + 1;
    entry.level = this.masteryLevel(entry.uses);
    this.writeAccountMeta(meta);
    return entry.level;
  }

  /** Compute mastery level from accumulated uses. */
  static masteryLevel(uses: number): number {
    let lvl = 0;
    for (const threshold of this.MASTERY_THRESHOLDS) {
      if (uses >= threshold) lvl++;
      else break;
    }
    return lvl;
  }

  /** Get current mastery level for a weapon family (0–5). */
  static getMasteryLevel(family: string): number {
    const meta = this.loadAccountMeta();
    if (!meta.masteries) return 0;
    const entry = meta.masteries.find(m => m.family === family);
    return entry ? entry.level : 0;
  }

  /** Get current mastery use count for a weapon family. */
  static getMasteryUses(family: string): number {
    const meta = this.loadAccountMeta();
    if (!meta.masteries) return 0;
    const entry = meta.masteries.find(m => m.family === family);
    return entry ? entry.uses : 0;
  }

  static logTelemetry(entry: TelemetryEntry): void {
    try {
      const raw = localStorage.getItem('nd_telemetry');
      const list = raw ? JSON.parse(raw) : [];
      list.push(entry);
      if (list.length > 100) list.shift();
      localStorage.setItem('nd_telemetry', JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}

export interface TelemetryEntry {
  causeOfDeath: string;
  floor: number;
  layoutSeed: number;
  elapsedMs: number;
  endedAt: string;
  modifiers: {
    masochist: boolean;
    ironbound: boolean;
    starved: boolean;
    hunted: boolean;
    blackout: boolean;
    glass: boolean;
    wrongfooted: boolean;
  };
}
