import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyStudioServerToken } from '../lib/studioServerAuth.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Brak autoryzacji: zaloguj się na konto Studio AI lub Google.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Check signed Studio AI account session token
  if (token.startsWith('st_ai.')) {
    const studioClaims = verifyStudioServerToken(token);
    if (!studioClaims) {
      return res
        .status(401)
        .json({ error: 'Nieprawidłowa lub wygasła sesja konta Studio AI.' });
    }
    req.user = {
      uid: studioClaims.uid,
      email: studioClaims.email,
      name: studioClaims.name,
      email_verified: true,
      aud: 'aether-tactile-studio',
      auth_time: studioClaims.iat,
      exp: studioClaims.exp,
      iat: studioClaims.iat,
      iss: 'aether-tactile-studio',
      sub: studioClaims.uid,
      firebase: {
        identities: { email: [studioClaims.email] },
        sign_in_provider: 'studio_ai',
      },
    } as DecodedIdToken;
    return next();
  }

  // 2. Fallback to Firebase Google ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Nieprawidłowy lub wygasły token autoryzacji.' });
  }
};
