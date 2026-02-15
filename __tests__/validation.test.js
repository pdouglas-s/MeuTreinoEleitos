const { isValidEmail, normalizeEmail } = require('../src/utils/validation');

describe('validation utils', () => {
  test('normalizeEmail trims and lowercases value', () => {
    expect(normalizeEmail('  Pedro@Hotmail.Com  ')).toBe('pedro@hotmail.com');
  });

  test('isValidEmail rejects long invalid TLD like .commmm', () => {
    expect(isValidEmail('pedro@hotmail.commmm')).toBe(false);
  });

  test('isValidEmail rejects typo TLD like .comm', () => {
    expect(isValidEmail('pedro@hotmail.comm')).toBe(false);
  });

  test('isValidEmail accepts common valid email', () => {
    expect(isValidEmail('pedro@hotmail.com')).toBe(true);
  });

  test('isValidEmail accepts .com.br email', () => {
    expect(isValidEmail('pedro@hotmail.com.br')).toBe(true);
  });
});
