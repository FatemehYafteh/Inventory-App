import { useCallback, useRef } from 'react';

/**
 * Radix returns focus to a `DialogTrigger` when a dialog closes. Dialogs opened from ordinary
 * buttons have none, so focus would fall to the page body. Call `remember()` as the dialog
 * opens and pass `onCloseAutoFocus` to the dialog content: focus goes back to the opener, or to
 * `fallbackRef` when the opener is gone (a deleted card, for example).
 */
export function useReturnFocus(fallbackRef) {
  const opener = useRef(null);

  const remember = useCallback(() => {
    opener.current = document.activeElement;
  }, []);

  const onCloseAutoFocus = useCallback(
    (event) => {
      event.preventDefault();
      const target = opener.current?.isConnected ? opener.current : fallbackRef?.current;
      target?.focus();
    },
    [fallbackRef],
  );

  return { remember, onCloseAutoFocus };
}
