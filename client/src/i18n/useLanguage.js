import { useEffect } from 'react';
import { useMe, useUpdateProfile } from '@/lib/auth';
import i18n, { rememberLanguage, storedLanguage } from './index';

/**
 * The language the signed-in user has saved wins. A user with an incomplete profile cannot save
 * one yet (the profile update is closed to them), so their browser choice wins until they can.
 */
function languageOf(user) {
  if (!user?.language) return null;
  return user.profileComplete ? user.language : (storedLanguage() ?? user.language);
}

/** Keeps the UI language in step with the signed-in user's saved language. Mount once. */
export function useLanguageSync() {
  const { data: user } = useMe({ enabled: false });
  const wanted = languageOf(user);
  useEffect(() => {
    if (wanted && wanted !== i18n.language) {
      rememberLanguage(wanted);
      i18n.changeLanguage(wanted);
    }
  }, [wanted]);
}

/**
 * The current language and a function that changes it. The change shows at once and is kept in
 * the browser; a signed-in user with a complete profile also saves it on their account. When
 * that save fails, `saveFailed` is true and the new language stays on this device only.
 */
export function useLanguage() {
  const { data: user } = useMe({ enabled: false });
  const updateProfile = useUpdateProfile();

  function setLanguage(language) {
    if (language === i18n.language) return;
    rememberLanguage(language);
    i18n.changeLanguage(language);
    if (user?.profileComplete) updateProfile.mutate({ language });
  }

  return { language: i18n.language, setLanguage, saveFailed: updateProfile.isError };
}
