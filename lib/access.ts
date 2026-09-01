export const OWNER_PHONES = ['62993322946', '62995113387', '62991187869'] as const;

export function isOwnerPhone(phone: string) {
  return OWNER_PHONES.includes(phone as (typeof OWNER_PHONES)[number]);
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function validPhone(value: string) {
  return /^\d{10,13}$/.test(value);
}
