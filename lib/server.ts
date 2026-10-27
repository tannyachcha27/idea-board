import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export class BoardError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
function sign(value: string) {
  return createHmac('sha256', env('BOARD_API_SECRET')).update(value).digest('hex');
}
const cookieName = 'idea-board-voter';
export async function voter(create = false): Promise<string | undefined> {
  const jar = await cookies();
  const cookie = jar.get(cookieName)?.value;
  if (cookie) {
    const [id, signature] = cookie.split('.');
    if (/^[a-f0-9]{64}$/.test(id) && /^[a-f0-9]{64}$/.test(signature ?? '')) {
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`cookie:${id}`)))) return sign(`voter:${id}`);
    }
  }
  if (!create) return;
  const id = randomBytes(32).toString('hex');
  jar.set(cookieName, `${id}.${sign(`cookie:${id}`)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return sign(`voter:${id}`);
}
export function voteToken(ideaId: string, voterId: string) {
  return sign(`vote:${ideaId}:${voterId}`);
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) throw new BoardError(403, 'Please submit from this website.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new BoardError(415, 'Expected JSON.');
}
export async function body(request: NextRequest) {
  // Limit actual bytes even for chunked requests, not just Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new BoardError(400, 'A request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new BoardError(413, 'That submission is too large.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new BoardError(400, 'Invalid JSON.'); }
}
export function field(data: unknown, key: string, min: number, max: number) {
  const value = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined;
  if (typeof value !== 'string' || [...value.trim()].length < min || [...value.trim()].length > max)
    throw new BoardError(400, `${key.replaceAll('_', ' ')} must be ${min}–${max} characters.`);
  return value.trim();
}
export async function database(path: string, init: RequestInit = {}, voterId?: string) {
  const headers = new Headers(init.headers);
  headers.set('apikey', env('SUPABASE_PUBLISHABLE_KEY'));
  headers.set('Content-Type', 'application/json');
  if (voterId) {
    headers.set('x-board-secret', env('BOARD_API_SECRET'));
    headers.set('x-voter-id', voterId);
  }
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.code === '23505') throw new BoardError(409, 'You have already voted for this idea.');
    if (error.code === '23503') throw new BoardError(404, 'This idea is no longer available.');
    console.error('Database request failed', { status: response.status, code: error.code });
    throw new BoardError(503, 'The board is temporarily unavailable. Please try again.');
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export function failure(error: unknown) {
  if (error instanceof BoardError) return Response.json({ error: error.message }, { status: error.status });
  console.error('Board request failed', error instanceof Error ? error.name : 'Unknown error');
  return Response.json({ error: 'The board is temporarily unavailable. Please try again.' }, { status: 503 });
}
