const ITERATIONS = 210_000;
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA';
const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function createPasswordRecord(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = encodeBytes(saltBytes);
  return { salt, hash: await derivePassword(password, salt) };
}

export async function verifyPassword(password: string, hash?: string | null, salt?: string | null) {
  const expectedHash = hash || DUMMY_HASH;
  const candidateHash = await derivePassword(password, salt || DUMMY_SALT);
  return Boolean(hash && salt) && constantTimeEqual(candidateHash, expectedHash);
}

function validPasswordInput(password: string) {
  if (password.length < 6 || password.length > 128) {
    throw new Error('A senha precisa ter entre 6 e 128 caracteres.');
  }
}

export function assertValidPassword(password: string) {
  validPasswordInput(password);
}

async function derivePassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: decodeBytes(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return encodeBytes(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function encodeBytes(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBytes(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
