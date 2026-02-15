const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|net|org)(\.br)?$/i;
export const MIN_PASSWORD_LENGTH = 6;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

export function isValidPassword(password) {
  return String(password || '').length >= MIN_PASSWORD_LENGTH;
}
