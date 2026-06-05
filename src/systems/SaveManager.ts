import { getSupabase } from '../lib/supabase';
import { CharacterSave } from '../types';

const LOCAL_KEY     = 'nd_save_v1';
const PLAYER_ID_KEY = 'nd_player_id';

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
      return raw ? (JSON.parse(raw) as CharacterSave) : null;
    } catch {
      return null;
    }
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
}
