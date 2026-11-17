import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const isFileProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'file:';

export const isStandaloneOfflineRuntime =
  typeof window !== 'undefined' &&
  (Boolean(
    (window as unknown as { __AETHER_STANDALONE_OFFLINE__?: boolean })
      .__AETHER_STANDALONE_OFFLINE__
  ) ||
    isFileProtocol);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();
export { firebaseConfig };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFirestoreQuotaOrErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let innerMsg = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      innerMsg = parsed.error;
    }
  } catch {
    // Not a JSON error wrapper
  }

  if (
    innerMsg.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    )
  ) {
    return `Przekroczono dzienny darmowy limit odczytów Firestore. Limit odnowi się kolejnego dnia. Szczegóły bazy: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
  }

  if (innerMsg.includes('Quota exceeded.')) {
    return 'Przekroczono dzienny limit Firestore (plan Spark Enterprise). Limit odnowi się następnego dnia (szczegóły: https://firebase.google.com/pricing#cloud-firestore).';
  }

  if (innerMsg.includes('Missing or insufficient permissions')) {
    return 'Brak uprawnień Firestore do wykonania operacji — upewnij się, że jesteś zalogowany zweryfikowanym kontem.';
  }

  return 'Wystąpił błąd komunikacji z bazą Firestore — migawki są bezpiecznie zapisywane w lokalnym skarbcu konta.';
}

async function testConnection(): Promise<void> {
  if (typeof navigator !== 'undefined' && (!navigator.onLine || isFileProtocol)) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline') &&
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      !isFileProtocol
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
