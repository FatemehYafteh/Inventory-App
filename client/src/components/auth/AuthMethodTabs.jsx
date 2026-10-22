import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TelegramSignIn } from '@/components/auth/TelegramSignIn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * The two ways in on the Login and Register pages: the email form (`email`, the default) and
 * Telegram. Both panels stay mounted, so switching tabs keeps what was typed and a Telegram
 * request in progress.
 */
export function AuthMethodTabs({ email }) {
  const { t } = useTranslation();
  const [method, setMethod] = useState('email');
  return (
    <Tabs value={method} onValueChange={setMethod} className="gap-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">{t('auth.methods.email')}</TabsTrigger>
        <TabsTrigger value="telegram">{t('auth.methods.telegram')}</TabsTrigger>
      </TabsList>
      {/* Named apart from their tabs, so the panel is not a second "Email" label. */}
      <TabsContent
        value="email"
        forceMount
        hidden={method !== 'email'}
        aria-labelledby={undefined}
        aria-label={t('auth.methods.useEmail')}
      >
        {email}
      </TabsContent>
      <TabsContent
        value="telegram"
        forceMount
        hidden={method !== 'telegram'}
        aria-labelledby={undefined}
        aria-label={t('auth.methods.useTelegram')}
      >
        <TelegramSignIn />
      </TabsContent>
    </Tabs>
  );
}
