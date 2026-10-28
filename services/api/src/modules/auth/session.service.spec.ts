import { SessionService } from './session.service.js';

describe('SessionService', () => {
  const secret = 'x'.repeat(32);
  const sessions = new SessionService({ SESSION_SECRET: secret } as never);

  it('round-trips a token', () => {
    const token = sessions.issue('user-1', 'session', 60);
    expect(sessions.verify(token, 'session')).toBe('user-1');
  });

  it('rejects a tampered token', () => {
    const token = sessions.issue('user-1', 'session', 60);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), sub: 'admin' })).toString('base64url');
    expect(sessions.verify(`${forged}.${signature}`, 'session')).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = sessions.issue('user-1', 'session', -1);
    expect(sessions.verify(token, 'session')).toBeNull();
  });

  it('rejects a token of another kind', () => {
    const token = sessions.issue('user-1', 'socket', 60);
    expect(sessions.verify(token, 'session')).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const other = new SessionService({ SESSION_SECRET: 'y'.repeat(32) } as never);
    expect(sessions.verify(other.issue('user-1', 'session', 60), 'session')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(sessions.verify('garbage', 'session')).toBeNull();
    expect(sessions.verify('', 'session')).toBeNull();
  });
});
