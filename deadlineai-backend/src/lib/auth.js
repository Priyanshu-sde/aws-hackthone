import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AppError } from './errors.js';

let verifier = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.USER_POOL_ID,
      tokenUse: 'id',
      clientId: process.env.USER_POOL_CLIENT_ID,
    });
  }
  return verifier;
}

export async function verifyToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) {
    throw new AppError(401, 'Missing Authorization header');
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  try {
    const payload = await getVerifier().verify(token);
    return payload.sub;
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    throw new AppError(401, 'Invalid or expired token');
  }
}
