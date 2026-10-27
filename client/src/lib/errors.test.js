import { codeForMessage } from '@inventory/shared/errorCodes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import fa from '@/i18n/locales/fa/errors.json';
import { ApiError } from './api';
import { applyFieldErrors, errorMessage, translateMessage, translateNotice } from './errors';

afterEach(() => i18n.changeLanguage('en'));

const NAME_REQUIRED = 'Name is required';
const BAD_LOGIN = 'Invalid email or password';

const persianOf = (text) => fa.messages[codeForMessage(text)];

describe('translateMessage', () => {
  it('returns the text unchanged in English', () => {
    expect(translateMessage(NAME_REQUIRED)).toBe(NAME_REQUIRED);
  });

  it('translates a catalogue message in Persian', async () => {
    await i18n.changeLanguage('fa');

    expect(persianOf(NAME_REQUIRED)).toBeTruthy();
    expect(translateMessage(NAME_REQUIRED)).toBe(persianOf(NAME_REQUIRED));
    expect(translateMessage(NAME_REQUIRED)).not.toBe(NAME_REQUIRED);
  });

  it('shows text the catalogue does not know as it is, and never a raw key', async () => {
    await i18n.changeLanguage('fa');

    expect(translateMessage('Something nobody catalogued')).toBe('Something nobody catalogued');
    expect(translateMessage('')).toBe('');
    expect(translateMessage(undefined)).toBeUndefined();
  });
});

describe('errorMessage', () => {
  const apiError = (status, body) => new ApiError(status, body);

  it('shows the server message in English', () => {
    const error = apiError(401, { message: BAD_LOGIN, code: 'INVALID_CREDENTIALS' });

    expect(errorMessage(error)).toBe(BAD_LOGIN);
  });

  it('translates the message by its catalogue code in Persian', async () => {
    await i18n.changeLanguage('fa');
    const error = apiError(401, { message: BAD_LOGIN, code: 'INVALID_CREDENTIALS' });

    expect(errorMessage(error)).toBe(persianOf(BAD_LOGIN));
  });

  it('falls back to the translated generic code, then to the server message', async () => {
    await i18n.changeLanguage('fa');
    const known = apiError(409, {
      message: 'Used by 3 products, so it cannot be deleted',
      code: 'IN_USE',
    });
    const unknown = apiError(409, { message: 'A brand new message', code: 'BRAND_NEW_CODE' });

    expect(errorMessage(known)).toBe(fa.codes.IN_USE);
    expect(errorMessage(unknown)).toBe('A brand new message');
  });

  it('keeps the generic texts for rate limits and server errors', async () => {
    await i18n.changeLanguage('fa');

    expect(errorMessage(apiError(429, { message: 'Slow down', code: 'RATE_LIMITED' }))).toBe(
      i18n.t('common.tooManyAttempts'),
    );
    expect(errorMessage(apiError(500, { message: 'Boom', code: 'INTERNAL_ERROR' }))).toBe(
      i18n.t('common.somethingWrong'),
    );
    expect(errorMessage(null)).toBeNull();
  });
});

describe('applyFieldErrors', () => {
  it('puts the server field errors on the form, translated in Persian', async () => {
    await i18n.changeLanguage('fa');
    const setError = vi.fn();
    const error = new ApiError(400, {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { name: NAME_REQUIRED, other: 'ignored' },
      errorCodes: { name: codeForMessage(NAME_REQUIRED) },
    });

    applyFieldErrors(error, setError, ['name']);

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('name', { message: persianOf(NAME_REQUIRED) });
  });
});

describe('ApiError', () => {
  it('keeps every old property and carries the additive error codes', () => {
    const error = new ApiError(400, {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { name: NAME_REQUIRED },
      details: { n: 1 },
      errorCodes: { name: 'NAME_REQUIRED' },
    });

    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { name: NAME_REQUIRED },
      details: { n: 1 },
      errorCodes: { name: 'NAME_REQUIRED' },
    });
  });

  it('works with a response that has none of the new fields (the old contract)', () => {
    const error = new ApiError(404, { message: 'Not found', code: 'NOT_FOUND' });

    expect(error.errorCodes).toBeUndefined();
    expect(errorMessage(error)).toBe('Not found');
  });
});

describe('translateNotice', () => {
  it('translates a known server success message and leaves others alone', async () => {
    const text = 'Your email is verified. You can now log in.';

    expect(translateNotice(text)).toBe(text);
    await i18n.changeLanguage('fa');
    expect(translateNotice(text)).not.toBe(text);
    expect(translateNotice('Unknown notice')).toBe('Unknown notice');
  });
});
