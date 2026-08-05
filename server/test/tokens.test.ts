import { describe, it, expect } from 'vitest';
import {
  hashToken,
  signOAuthState,
  signRefreshToken,
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

  it('signRefreshToken produit des tokens uniques (jti)', () => {
    const a = signRefreshToken({ id: 'u1' });
    const b = signRefreshToken({ id: 'u1' });
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
