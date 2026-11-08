import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ME_QUERY_KEY, useMe, useUpdateProfile } from '@/lib/auth';
import { isDemoUser } from '@/lib/demo';
import i18n, { rememberLanguage, storedLanguage } from './index';

/**
 * The language the signed-in user has saved wins. A user with an incomplete profile cannot save
 * one yet (the profile update is closed to them), so their browser choice wins until they can.
 */
function languageOf(user) {
  if (!user?.language) return null;
  return user.profileComplete ? user.language : (storedLanguage() ?? user.language);
}

/** Whether a language change is saved on this user's account. */
function savesLanguage(user) {
  // The demo account is shared by every visitor, so one visitor's choice must not become the
  // next visitor's language. Its language stays in each browser.
  return Boolean(user?.profileComplete) && !isDemoUser(user);
}

/**
 * Keeps the UI language in step with the signed-in user. Mount once.
 * - Opening the app with a session: the language saved on the account wins.
 * - Signing in on this page (the session went from none to a user): the language the person was
 *   just using stays, and is saved on the account, so choosing English on the login page and
 *   signing in never switches the app to Persian.
 * - The demo account: the browser's language always wins and nothing is saved.
 */
export function useLanguageSync() {
  const { data: user } = useMe({ enabled: false });
  const { mutate: saveProfile } = useUpdateProfile();
  const queryClient = useQueryClient();
  const previous = useRef(user);

  useEffect(() => {
    const before = previous.current;
    previous.current = user;
    if (!user) return;
    if (isDemoUser(user)) return;

    if (before === null) {
      // Only an account with a saved language is updated; without one there is nothing that
      // could switch the app away from what the person was using.
      if (savesLanguage(user) && user.language && user.language !== i18n.language) {
        const language = i18n.language;
        // Shown at once, so a refetch of the session before the save answers cannot switch back.
        queryClient.setQueryData(ME_QUERY_KEY, { ...user, language });
        saveProfile({ language });
      }
      return;
    }

    const wanted = languageOf(user);
    if (wanted && wanted !== i18n.language) {
      rememberLanguage(wanted);
      i18n.changeLanguage(wanted);
    }
  }, [user, queryClient, saveProfile]);
}

/**
 * The current language and a function that changes it. The change shows at once and is kept in
 * the browser; a signed-in user with a complete profile also saves it on their account (not the
 * shared demo account). When that save fails, `saveFailed` is true and the new language stays on
 * this device only.
 */
export function useLanguage() {
  const { data: user } = useMe({ enabled: false });
  const updateProfile = useUpdateProfile();

  function setLanguage(language) {
    if (language === i18n.language) return;
    rememberLanguage(language);
    i18n.changeLanguage(language);
    if (savesLanguage(user)) updateProfile.mutate({ language });
  }

  return { language: i18n.language, setLanguage, saveFailed: updateProfile.isError };
}
