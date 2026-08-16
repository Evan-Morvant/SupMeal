import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import {
  hashToken,
  signAccessToken,
  signOAuthState,
  signRefreshToken,
  verifyAccessToken,
  verifyOAuthState,
} from '../src/common/tokens';

describe('tokens', () => {
  it('hashToken est déterministe et discrimine', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('un state OAuth valide se vérifie pour le bon provider', () => {
    const state = signOAuthState('github');
    expect(() => verifyOAuthState(state, 'github')).not.toThrow();
  });

  it('un state OAuth est rejeté pour un autre provider', () => {
    const state = signOAuthState('github');
    expect(() => verifyOAuthState(state, 'google')).toThrow();
  });

  // Le state part dans une redirection publique : s'il était signé de la clé
  // d'accès, GET /auth/oauth/:provider distribuerait des tokens valides.
  it('un state OAuth ne passe pas pour un access token', () => {
    expect(() => verifyAccessToken(signOAuthState('github'))).toThrow();
  });

  it('un access token sans id exploitable est rejeté', () => {
    const forged = jwt.sign({ email: 'a@b.c' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('un access token normal se vérifie et rend son identité', () => {
    const user = { id: 'u1', email: 'a@b.c' };
    expect(verifyAccessToken(signAccessToken(user))).toMatchObject(user);
  });

  it('signRefreshToken produit des tokens uniques (jti)', () => {
    const a = signRefreshToken({ id: 'u1' });
    const b = signRefreshToken({ id: 'u1' });
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
