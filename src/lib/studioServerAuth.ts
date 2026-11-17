import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAULT_FILE_PATH = path.resolve(__dirname, '../../.aistudio/studio-accounts-vault.json');

const TOKEN_SECRET =
  process.env.STUDIO_AUTH_SECRET ||
  crypto
    .createHash('sha256')
    .update(`aether-tactile-studio-auth-${process.env.APP_URL || 'local-vault-v1'}`)
    .digest('hex');

export interface ServerStudioAccountRecord {
  uid: string;
  studioId: string;
  email: string;
  displayName: string;
  organization: string;
  role: string;
  passwordSalt: string;
  passwordHash: string;
  recoveryCodeHash: string;
  createdAt: string;
  lastLoginAt: string;
  workspaceBackup?: Record<string, unknown>;
}

interface VaultFileStructure {
  accounts: Record<string, ServerStudioAccountRecord>;
}

let memoryVault: VaultFileStructure | null = null;

function loadVault(): VaultFileStructure {
  if (memoryVault) return memoryVault;
  try {
    if (fs.existsSync(VAULT_FILE_PATH)) {
      const raw = fs.readFileSync(VAULT_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as VaultFileStructure;
      if (parsed && typeof parsed.accounts === 'object' && parsed.accounts !== null) {
        memoryVault = parsed;
        return memoryVault;
      }
    }
  } catch {
    // Fallback to in-memory vault if disk read fails
  }
  memoryVault = { accounts: {} };
  return memoryVault;
}

function saveVault(vault: VaultFileStructure): void {
  memoryVault = vault;
  try {
    const dir = path.dirname(VAULT_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(vault, null, 2), 'utf8');
  } catch {
    // Keep in-memory state if environment filesystem is read-only
  }
}

function hashSecretScrypt(secret: string, salt: string): string {
  return crypto.scryptSync(secret, salt, 64).toString('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export interface StudioSessionClaims {
  uid: string;
  studioId: string;
  email: string;
  name: string;
  role: string;
  organization: string;
  iat: number;
  exp: number;
}

export function issueStudioServerToken(account: ServerStudioAccountRecord): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: StudioSessionClaims = {
    uid: account.uid,
    studioId: account.studioId,
    email: account.email,
    name: account.displayName,
    role: account.role,
    organization: account.organization,
    iat: nowSec,
    exp: nowSec + 60 * 60 * 24 * 30, // 30 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`st_ai.${payloadB64}`)
    .digest('base64url');
  return `st_ai.${payloadB64}.${sigB64}`;
}

export function verifyStudioServerToken(token: string): StudioSessionClaims | null {
  if (!token || !token.startsWith('st_ai.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`st_ai.${payloadB64}`)
    .digest('base64url');

  if (sigB64.length !== expectedSig.length) return null;
  const validSig = crypto.timingSafeEqual(
    Buffer.from(sigB64, 'utf8'),
    Buffer.from(expectedSig, 'utf8')
  );
  if (!validSig) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as StudioSessionClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed.uid || !parsed.email || parsed.exp < nowSec) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let chars = '';
  for (let i = 0; i < 12; i++) {
    chars += alphabet[bytes[i] % alphabet.length];
  }
  return `AETH-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function generateStudioId(email: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}-${Date.now()}`)
    .digest('hex')
    .toUpperCase();
  return `STU-${digest.slice(0, 4)}-${digest.slice(4, 8)}`;
}

export function registerServerStudioAccount(params: {
  email: string;
  password: string;
  displayName: string;
  organization?: string;
  role?: string;
  clientRecoveryCode?: string;
  clientStudioId?: string;
  clientUid?: string;
}): {
  account: Omit<
    ServerStudioAccountRecord,
    'passwordSalt' | 'passwordHash' | 'recoveryCodeHash' | 'workspaceBackup'
  >;
  token: string;
  recoveryCode: string;
} {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Podaj prawidłowy adres e-mail konta Studio AI.');
  }
  if (!params.password || params.password.length < 8) {
    throw new Error('Hasło do konta Studio AI musi zawierać co najmniej 8 znaków.');
  }
  const cleanName =
    params.displayName.trim().slice(0, 80) || cleanEmail.split('@')[0] || 'Twórca Studio';

  const vault = loadVault();
  if (vault.accounts[cleanEmail]) {
    throw new Error(
      'Konto Studio AI z tym adresem e-mail jest już zarejestrowane. Przejdź do zakładki Logowanie.'
    );
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashSecretScrypt(params.password, salt);
  const recoveryCode =
    params.clientRecoveryCode && /^AETH-[A-Z0-9-]{10,20}$/.test(params.clientRecoveryCode)
      ? params.clientRecoveryCode
      : generateRecoveryCode();
  const normalizedRecovery = recoveryCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const recoveryCodeHash = hashSecretScrypt(normalizedRecovery, salt);

  const emailHash = crypto
    .createHash('sha256')
    .update(cleanEmail)
    .digest('hex')
    .slice(0, 20);
  const uid =
    params.clientUid && /^studio_[a-zA-Z0-9_-]{6,64}$/.test(params.clientUid)
      ? params.clientUid
      : `studio_${emailHash}`;
  const studioId =
    params.clientStudioId && /^STU-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(params.clientStudioId)
      ? params.clientStudioId
      : generateStudioId(cleanEmail);

  const nowIso = new Date().toISOString();
  const record: ServerStudioAccountRecord = {
    uid,
    studioId,
    email: cleanEmail,
    displayName: cleanName,
    organization: (params.organization || 'Aether Independent Lab').trim().slice(0, 80),
    role: (params.role || 'Projektant UI/UX').trim().slice(0, 60),
    passwordSalt: salt,
    passwordHash,
    recoveryCodeHash,
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };

  vault.accounts[cleanEmail] = record;
  saveVault(vault);

  const token = issueStudioServerToken(record);
  return {
    account: {
      uid: record.uid,
      studioId: record.studioId,
      email: record.email,
      displayName: record.displayName,
      organization: record.organization,
      role: record.role,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
    },
    token,
    recoveryCode,
  };
}

export function loginServerStudioAccount(params: {
  email: string;
  password: string;
}): {
  account: Omit<
    ServerStudioAccountRecord,
    'passwordSalt' | 'passwordHash' | 'recoveryCodeHash' | 'workspaceBackup'
  >;
  token: string;
  workspaceBackup?: Record<string, unknown>;
} {
  const cleanEmail = params.email.trim().toLowerCase();
  const vault = loadVault();
  const record = vault.accounts[cleanEmail];
  if (!record) {
    throw new Error('Nie znaleziono konta Studio AI dla podanego adresu e-mail.');
  }

  const candidateHash = hashSecretScrypt(params.password || '', record.passwordSalt);
  if (!safeEqualHex(candidateHash, record.passwordHash)) {
    throw new Error('Nieprawidłowe hasło do konta Studio AI.');
  }

  record.lastLoginAt = new Date().toISOString();
  saveVault(vault);

  const token = issueStudioServerToken(record);
  return {
    account: {
      uid: record.uid,
      studioId: record.studioId,
      email: record.email,
      displayName: record.displayName,
      organization: record.organization,
      role: record.role,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
    },
    token,
    workspaceBackup: record.workspaceBackup,
  };
}

export function recoverServerStudioAccountPassword(params: {
  email: string;
  recoveryCode: string;
  newPassword: string;
}): {
  account: Omit<
    ServerStudioAccountRecord,
    'passwordSalt' | 'passwordHash' | 'recoveryCodeHash' | 'workspaceBackup'
  >;
  token: string;
} {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!params.newPassword || params.newPassword.length < 8) {
    throw new Error('Nowe hasło musi mieć co najmniej 8 znaków.');
  }
  const vault = loadVault();
  const record = vault.accounts[cleanEmail];
  if (!record) {
    throw new Error('Nie znaleziono konta Studio AI dla podanego adresu e-mail.');
  }

  const normalizedRecovery = (params.recoveryCode || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
  const candidateRecoveryHash = hashSecretScrypt(normalizedRecovery, record.passwordSalt);
  if (!safeEqualHex(candidateRecoveryHash, record.recoveryCodeHash)) {
    throw new Error('Podany klucz odzyskiwania konta Studio AI jest nieprawidłowy.');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  record.passwordSalt = newSalt;
  record.passwordHash = hashSecretScrypt(params.newPassword, newSalt);
  record.recoveryCodeHash = hashSecretScrypt(normalizedRecovery, newSalt);
  record.lastLoginAt = new Date().toISOString();
  saveVault(vault);

  const token = issueStudioServerToken(record);
  return {
    account: {
      uid: record.uid,
      studioId: record.studioId,
      email: record.email,
      displayName: record.displayName,
      organization: record.organization,
      role: record.role,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
    },
    token,
  };
}

export function saveServerAccountWorkspaceBackup(
  email: string,
  workspaceBackup: Record<string, unknown>
): string {
  const cleanEmail = email.trim().toLowerCase();
  const vault = loadVault();
  const record = vault.accounts[cleanEmail];
  if (!record) {
    throw new Error('Konto Studio AI nie istnieje w rejestrze serwera.');
  }
  const syncedAt = new Date().toISOString();
  record.workspaceBackup = {
    ...workspaceBackup,
    syncedAt,
  };
  saveVault(vault);
  return syncedAt;
}

export function getServerAccountByEmail(email: string): ServerStudioAccountRecord | null {
  const cleanEmail = email.trim().toLowerCase();
  const vault = loadVault();
  return vault.accounts[cleanEmail] || null;
}
