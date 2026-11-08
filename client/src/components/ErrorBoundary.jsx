import { Component } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

function CrashScreen() {
  const { t } = useTranslation();
  return (
    <main
      role="alert"
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center"
    >
      <h1 className="text-xl font-semibold">{t('common.crash.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('common.crash.description')}</p>
      <Button onClick={() => window.location.reload()}>{t('common.crash.reload')}</Button>
    </main>
  );
}

/**
 * Catches an error thrown while rendering (a bug, or a page whose code failed to download after a
 * new version was deployed) and shows a message with a reload button, instead of a blank page.
 */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[ui] render error', error);
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}
