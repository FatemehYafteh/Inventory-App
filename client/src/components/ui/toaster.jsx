import { Toaster as HotToaster } from 'react-hot-toast';

// Mount once near the app root, then call toast() from 'react-hot-toast' anywhere.
function Toaster(props) {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        className: 'text-sm',
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
