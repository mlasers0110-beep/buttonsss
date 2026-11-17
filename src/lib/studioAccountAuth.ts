import { StudioSnapshotRecord } from '../types/studio';

const ACCOUNTS_VAULT_KEY = 'aether_studio_ai_accounts_vault_v1';
const ACTIVE_SESSION_KEY = 'aether_studio_ai_active_session_v1';
const SNAPSHOTS_VAULT_PREFIX = 'aether_studio_ai_snapshots_v1_';

const memoryStorageFallback = new Map<string, string>();

export function safeLocalGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Restricted file:// storage fallback
  }
  return memoryStorageFallback.get(key) ?? null;
}

export function safeLocalSet(key: string, value: string): void {
  memoryStorageFallback.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Keep in memoryStorageFallback
  }
}

export function safeLocalRemove(key: string): void {
  memoryStorageFallback.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

// ============================================================================
// Pure-TypeScript SHA-256 (Guaranteed to work on file://, http://, and https://)
// ============================================================================
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256HexSync(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  const bitLen = utf8.length * 8;
  const totalBytes = Math.ceil((utf8.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalBytes);
  padded.set(utf8);
  padded[utf8.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(totalBytes - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalBytes - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalBytes; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

export function deriveStudioSecretVerifier(secret: string, salt: string): string {
  let acc = sha256HexSync(`aether-v1:${salt}:${secret}`);
  for (let i = 0; i < 1200; i++) {
    acc = sha256HexSync(`${acc}:${salt}:${i}`);
  }
  return acc;
}

function randomHex(byteCount: number): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(byteCount);
    window.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let out = '';
  for (let i = 0; i < byteCount; i++) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

export function generateOfflineRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hex = randomHex(12);
  let chars = '';
  for (let i = 0; i < 12; i++) {
    const byteVal = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    chars += alphabet[byteVal % alphabet.length];
  }
  return `AETH-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export interface StudioAccountProfile {
  uid: string;
  studioId: string;
  email: string;
  displayName: string;
  organization: string;
  role: string;
  createdAt: string;
  lastLoginAt: string;
  authMode: 'studio-cloud' | 'studio-offline';
  serverToken?: string;
}

export interface StoredLocalStudioAccount {
  uid: string;
  studioId: string;
  email: string;
  displayName: string;
  organization: string;
  role: string;
  salt: string;
  passwordVerifier: string;
  recoveryVerifier: string;
  createdAt: string;
  lastLoginAt: string;
  cloudSynced: boolean;
  lastCloudSyncAt?: string;
}

export interface PortableAccountsVault {
  accounts: Record<string, StoredLocalStudioAccount>;
}

function readLocalAccountsVault(): PortableAccountsVault {
  try {
    const raw = safeLocalGet(ACCOUNTS_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortableAccountsVault;
      if (parsed && typeof parsed.accounts === 'object' && parsed.accounts !== null) {
        return parsed;
      }
    }
  } catch {
    // Ignore malformed vault
  }

  // Hydrate from standalone embedded HTML initial state if present
  if (typeof window !== 'undefined' && window.__AETHER_INITIAL_STATE__) {
    const embeddedVault = window.__AETHER_INITIAL_STATE__.accountsVault as
      | PortableAccountsVault
      | undefined;
    if (
      embeddedVault &&
      typeof embeddedVault.accounts === 'object' &&
      embeddedVault.accounts !== null
    ) {
      safeLocalSet(ACCOUNTS_VAULT_KEY, JSON.stringify(embeddedVault));
      return embeddedVault;
    }
  }

  return { accounts: {} };
}

function writeLocalAccountsVault(vault: PortableAccountsVault): void {
  safeLocalSet(ACCOUNTS_VAULT_KEY, JSON.stringify(vault));
}

export function getPortableAccountsVaultForBundle(): PortableAccountsVault {
  return readLocalAccountsVault();
}

export function listRegisteredLocalStudioAccounts(): Array<{
  email: string;
  displayName: string;
  studioId: string;
  role: string;
  organization: string;
  cloudSynced: boolean;
}> {
  const vault = readLocalAccountsVault();
  return Object.values(vault.accounts).map((acc) => ({
    email: acc.email,
    displayName: acc.displayName,
    studioId: acc.studioId,
    role: acc.role,
    organization: acc.organization,
    cloudSynced: acc.cloudSynced,
  }));
}

export function getStoredActiveStudioSession(): StudioAccountProfile | null {
  try {
    const raw = safeLocalGet(ACTIVE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioAccountProfile;
      if (parsed && parsed.uid && parsed.email) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined' && window.__AETHER_INITIAL_STATE__) {
    const embeddedProfile = window.__AETHER_INITIAL_STATE__.activeStudioProfile as
      | StudioAccountProfile
      | undefined;
    if (embeddedProfile && embeddedProfile.uid && embeddedProfile.email) {
      const sanitized: StudioAccountProfile = {
        ...embeddedProfile,
        authMode: 'studio-offline',
      };
      safeLocalSet(ACTIVE_SESSION_KEY, JSON.stringify(sanitized));
      return sanitized;
    }
  }

  return null;
}

export function clearStoredActiveStudioSession(): void {
  safeLocalRemove(ACTIVE_SESSION_KEY);
}

export function resolveCloudOriginUrl(): string {
  if (typeof window === 'undefined') return '';
  if (
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
  ) {
    return '';
  }
  const embeddedOrigin = window.__AETHER_CLOUD_ORIGIN__;
  if (typeof embeddedOrigin === 'string' && embeddedOrigin.startsWith('http')) {
    return embeddedOrigin.replace(/\/+$/, '');
  }
  return '';
}

export function evaluatePasswordStrength(password: string): {
  score: number; // 0..4
  label: string;
} {
  if (!password) return { score: 0, label: 'Wprowadź hasło (min. 8 znaków)' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = [
    'Zbyt krótkie',
    'Podstawowe',
    'Dobre',
    'Silne',
    'Bardzo silne (Kryptograficzne)',
  ];
  return { score, label: labels[Math.min(4, score)] };
}

export async function registerStudioAiAccount(params: {
  displayName: string;
  email: string;
  password: string;
  organization?: string;
  role?: string;
}): Promise<{
  profile: StudioAccountProfile;
  recoveryCode: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Podaj prawidłowy adres e-mail dla konta Studio AI.');
  }
  if (!params.password || params.password.length < 8) {
    throw new Error('Hasło musi mieć długość co najmniej 8 znaków.');
  }

  const cleanName =
    params.displayName.trim().slice(0, 80) ||
    cleanEmail.split('@')[0] ||
    'Projektant Studio AI';
  const cleanOrg = (params.organization || 'Pracownia Aether Studio')
    .trim()
    .slice(0, 80);
  const cleanRole = (params.role || 'Projektant UI/UX').trim().slice(0, 60);

  const vault = readLocalAccountsVault();
  if (vault.accounts[cleanEmail]) {
    throw new Error(
      'Konto Studio AI dla tego adresu e-mail istnieje już w skarbcu aplikacji. Przejdź do logowania.'
    );
  }

  const emailDigest = sha256HexSync(cleanEmail);
  const uid = `studio_${emailDigest.slice(0, 20)}`;
  const studioId = `STU-${emailDigest.slice(0, 4).toUpperCase()}-${randomHex(2).toUpperCase()}`;
  const recoveryCode = generateOfflineRecoveryCode();
  const normalizedRecovery = recoveryCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  const salt = randomHex(16);
  const passwordVerifier = deriveStudioSecretVerifier(params.password, salt);
  const recoveryVerifier = deriveStudioSecretVerifier(normalizedRecovery, salt);
  const nowIso = new Date().toISOString();

  let serverToken: string | undefined;
  let cloudSynced = false;
  let finalStudioId = studioId;
  let finalUid = uid;
  let finalRecoveryCode = recoveryCode;

  const baseOrigin = resolveCloudOriginUrl();
  const canReachCloud =
    typeof navigator !== 'undefined' &&
    navigator.onLine &&
    (window.location.protocol.startsWith('http') || Boolean(baseOrigin));

  if (canReachCloud) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseOrigin}/api/studio-auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: params.password,
          displayName: cleanName,
          organization: cleanOrg,
          role: cleanRole,
          clientRecoveryCode: recoveryCode,
          clientStudioId: studioId,
          clientUid: uid,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await resp.json();
      if (resp.ok && data?.token) {
        serverToken = data.token;
        cloudSynced = true;
        if (data.account?.studioId) finalStudioId = data.account.studioId;
        if (data.account?.uid) finalUid = data.account.uid;
        if (data.recoveryCode) finalRecoveryCode = data.recoveryCode;
      } else if (resp.status === 409 || (data?.error && String(data.error).includes('już zarejestrowane'))) {
        throw new Error(data.error);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('już zarejestrowane')) {
        throw err;
      }
      // Offline / standalone fallback: proceed with local cryptographic registration
    }
  }

  const storedRecord: StoredLocalStudioAccount = {
    uid: finalUid,
    studioId: finalStudioId,
    email: cleanEmail,
    displayName: cleanName,
    organization: cleanOrg,
    role: cleanRole,
    salt,
    passwordVerifier,
    recoveryVerifier,
    createdAt: nowIso,
    lastLoginAt: nowIso,
    cloudSynced,
    lastCloudSyncAt: cloudSynced ? nowIso : undefined,
  };

  vault.accounts[cleanEmail] = storedRecord;
  writeLocalAccountsVault(vault);

  const profile: StudioAccountProfile = {
    uid: finalUid,
    studioId: finalStudioId,
    email: cleanEmail,
    displayName: cleanName,
    organization: cleanOrg,
    role: cleanRole,
    createdAt: nowIso,
    lastLoginAt: nowIso,
    authMode: cloudSynced ? 'studio-cloud' : 'studio-offline',
    serverToken,
  };

  safeLocalSet(ACTIVE_SESSION_KEY, JSON.stringify(profile));

  return {
    profile,
    recoveryCode: finalRecoveryCode,
  };
}

export async function loginStudioAiAccount(params: {
  email: string;
  password: string;
}): Promise<{
  profile: StudioAccountProfile;
  workspaceBackup?: Record<string, unknown>;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !params.password) {
    throw new Error('Wprowadź adres e-mail oraz hasło do konta Studio AI.');
  }

  const vault = readLocalAccountsVault();
  const baseOrigin = resolveCloudOriginUrl();
  const canReachCloud =
    typeof navigator !== 'undefined' &&
    navigator.onLine &&
    (window.location.protocol.startsWith('http') || Boolean(baseOrigin));

  // 1. Try Cloud Studio AI Login when online
  if (canReachCloud) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseOrigin}/api/studio-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: params.password,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = await resp.json();
      if (resp.ok && data?.account && data?.token) {
        const nowIso = new Date().toISOString();
        const existingLocal = vault.accounts[cleanEmail];
        const salt = existingLocal?.salt || randomHex(16);
        const passwordVerifier = deriveStudioSecretVerifier(params.password, salt);

        vault.accounts[cleanEmail] = {
          uid: data.account.uid,
          studioId: data.account.studioId,
          email: cleanEmail,
          displayName: data.account.displayName,
          organization: data.account.organization || 'Pracownia Aether Studio',
          role: data.account.role || 'Projektant UI/UX',
          salt,
          passwordVerifier,
          recoveryVerifier:
            existingLocal?.recoveryVerifier ||
            deriveStudioSecretVerifier(randomHex(8), salt),
          createdAt: data.account.createdAt || nowIso,
          lastLoginAt: nowIso,
          cloudSynced: true,
          lastCloudSyncAt: nowIso,
        };
        writeLocalAccountsVault(vault);

        const profile: StudioAccountProfile = {
          uid: data.account.uid,
          studioId: data.account.studioId,
          email: cleanEmail,
          displayName: data.account.displayName,
          organization: data.account.organization || 'Pracownia Aether Studio',
          role: data.account.role || 'Projektant UI/UX',
          createdAt: data.account.createdAt || nowIso,
          lastLoginAt: nowIso,
          authMode: 'studio-cloud',
          serverToken: data.token,
        };
        safeLocalSet(ACTIVE_SESSION_KEY, JSON.stringify(profile));
        return {
          profile,
          workspaceBackup: data.workspaceBackup,
        };
      } else if (resp.status === 401 && vault.accounts[cleanEmail] === undefined) {
        throw new Error(data?.error || 'Nieprawidłowy e-mail lub hasło do konta Studio AI.');
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('Nieprawidłowy e-mail lub hasło')
      ) {
        throw err;
      }
      // Fall through to local cryptographic vault verification
    }
  }

  // 2. Local Offline Cryptographic Vault Verification
  const localRecord = vault.accounts[cleanEmail];
  if (!localRecord) {
    throw new Error(
      'Nie znaleziono konta Studio AI dla tego adresu e-mail w lokalnym skarbcu ani w chmurze. Zarejestruj nowe konto Studio AI.'
    );
  }

  const candidateVerifier = deriveStudioSecretVerifier(
    params.password,
    localRecord.salt
  );
  if (candidateVerifier !== localRecord.passwordVerifier) {
    throw new Error('Nieprawidłowe hasło dla konta Studio AI.');
  }

  const nowIso = new Date().toISOString();
  localRecord.lastLoginAt = nowIso;
  writeLocalAccountsVault(vault);

  const profile: StudioAccountProfile = {
    uid: localRecord.uid,
    studioId: localRecord.studioId,
    email: localRecord.email,
    displayName: localRecord.displayName,
    organization: localRecord.organization,
    role: localRecord.role,
    createdAt: localRecord.createdAt,
    lastLoginAt: nowIso,
    authMode: 'studio-offline',
  };
  safeLocalSet(ACTIVE_SESSION_KEY, JSON.stringify(profile));

  return { profile };
}

export async function recoverStudioAiAccount(params: {
  email: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<StudioAccountProfile> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !params.recoveryCode || !params.newPassword) {
    throw new Error('Wypełnij e-mail, klucz odzyskiwania oraz nowe hasło.');
  }
  if (params.newPassword.length < 8) {
    throw new Error('Nowe hasło musi zawierać co najmniej 8 znaków.');
  }

  const normalizedCode = params.recoveryCode
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
  const vault = readLocalAccountsVault();
  const baseOrigin = resolveCloudOriginUrl();
  const canReachCloud =
    typeof navigator !== 'undefined' &&
    navigator.onLine &&
    (window.location.protocol.startsWith('http') || Boolean(baseOrigin));

  let serverToken: string | undefined;
  let cloudRecovered = false;

  if (canReachCloud) {
    try {
      const resp = await fetch(`${baseOrigin}/api/studio-auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          recoveryCode: params.recoveryCode,
          newPassword: params.newPassword,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data?.token && data?.account) {
        serverToken = data.token;
        cloudRecovered = true;
      }
    } catch {
      // Offline fallback
    }
  }

  const localRecord = vault.accounts[cleanEmail];
  if (!localRecord && !cloudRecovered) {
    throw new Error('Nie znaleziono konta Studio AI o podanym adresie e-mail.');
  }

  if (localRecord && !cloudRecovered) {
    const candidateRec = deriveStudioSecretVerifier(
      normalizedCode,
      localRecord.salt
    );
    if (candidateRec !== localRecord.recoveryVerifier) {
      throw new Error('Nieprawidłowy klucz odzyskiwania konta Offline (AETH-...).');
    }
  }

  const newSalt = randomHex(16);
  const nowIso = new Date().toISOString();
  const updated: StoredLocalStudioAccount = {
    uid: localRecord?.uid || `studio_${sha256HexSync(cleanEmail).slice(0, 20)}`,
    studioId:
      localRecord?.studioId ||
      `STU-${sha256HexSync(cleanEmail).slice(0, 4).toUpperCase()}-REC1`,
    email: cleanEmail,
    displayName: localRecord?.displayName || cleanEmail.split('@')[0],
    organization: localRecord?.organization || 'Pracownia Aether Studio',
    role: localRecord?.role || 'Projektant UI/UX',
    salt: newSalt,
    passwordVerifier: deriveStudioSecretVerifier(params.newPassword, newSalt),
    recoveryVerifier: deriveStudioSecretVerifier(normalizedCode, newSalt),
    createdAt: localRecord?.createdAt || nowIso,
    lastLoginAt: nowIso,
    cloudSynced: cloudRecovered || Boolean(localRecord?.cloudSynced),
    lastCloudSyncAt: cloudRecovered ? nowIso : localRecord?.lastCloudSyncAt,
  };

  vault.accounts[cleanEmail] = updated;
  writeLocalAccountsVault(vault);

  const profile: StudioAccountProfile = {
    uid: updated.uid,
    studioId: updated.studioId,
    email: updated.email,
    displayName: updated.displayName,
    organization: updated.organization,
    role: updated.role,
    createdAt: updated.createdAt,
    lastLoginAt: nowIso,
    authMode: cloudRecovered ? 'studio-cloud' : 'studio-offline',
    serverToken,
  };
  safeLocalSet(ACTIVE_SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export async function syncStudioAccountWorkspaceToCloud(
  profile: StudioAccountProfile,
  workspacePayload: Record<string, unknown>
): Promise<{ synced: boolean; syncedAt: string }> {
  const baseOrigin = resolveCloudOriginUrl();
  const nowFormatted = new Date().toLocaleTimeString('pl-PL');
  if (!profile.serverToken || typeof navigator === 'undefined' || !navigator.onLine) {
    return { synced: false, syncedAt: nowFormatted };
  }

  try {
    const resp = await fetch(`${baseOrigin}/api/studio-auth/workspace-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.serverToken}`,
      },
      body: JSON.stringify({ workspaceBackup: workspacePayload }),
    });
    if (resp.ok) {
      return { synced: true, syncedAt: nowFormatted };
    }
  } catch {
    // Offline fallback
  }
  return { synced: false, syncedAt: nowFormatted };
}

// ============================================================================
// Per-Account Offline Version History Snapshots Vault
// ============================================================================
export function loadLocalAccountSnapshots(uid: string): StudioSnapshotRecord[] {
  const key = `${SNAPSHOTS_VAULT_PREFIX}${uid}`;
  try {
    const raw = safeLocalGet(key);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioSnapshotRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined' && window.__AETHER_INITIAL_STATE__) {
    const embeddedSnaps = window.__AETHER_INITIAL_STATE__.snapshots as
      | StudioSnapshotRecord[]
      | undefined;
    if (Array.isArray(embeddedSnaps) && embeddedSnaps.length > 0) {
      safeLocalSet(key, JSON.stringify(embeddedSnaps));
      return embeddedSnaps;
    }
  }

  return [];
}

export function saveLocalAccountSnapshots(
  uid: string,
  records: StudioSnapshotRecord[]
): void {
  const key = `${SNAPSHOTS_VAULT_PREFIX}${uid}`;
  safeLocalSet(key, JSON.stringify(records.slice(0, 40)));
}
