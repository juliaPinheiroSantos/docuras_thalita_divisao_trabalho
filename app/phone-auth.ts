import { cookies } from 'next/headers';

import { getD1 } from '@/db';
import { ensureSchema, findActiveMemberById, type Member } from '@/db/store';
import { isOwnerPhone } from '@/lib/access';

const SESSION_COOKIE = 'docuras_phone_session';
const SESSION_DAYS = 30;

export async function createPhoneSession(memberId: string, credentialId: string) {
  await ensureSchema();
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getD1();

  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now.toISOString()),
    db.prepare(`INSERT INTO sessions (id, token_hash, user_id, credential_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), tokenHash, memberId, credentialId, expiresAt.toISOString(), now.toISOString()),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function getPhoneSessionMember(): Promise<Member | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await ensureSchema();
  const session = await getD1()
    .prepare(`SELECT s.user_id, c.phone
      FROM sessions s
      JOIN login_credentials c ON c.id = s.credential_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND c.password_hash IS NOT NULL
      LIMIT 1`)
    .bind(await hashToken(token), new Date().toISOString())
    .first<{ user_id: string; phone: string }>();
  if (!session) return null;

  const member = await findActiveMemberById(session.user_id);
  if (!member) return null;
  if (member.role === 'owner' && !isOwnerPhone(session.phone)) return null;
  return member;
}

export async function clearPhoneSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureSchema();
    await getD1()
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run();
  }
  cookieStore.delete(SESSION_COOKIE);
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
