import { useMutation } from '@tanstack/react-query';
import { apiDownload } from './api';

/** Hands a blob to the browser as a file download. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** `a=1&b=2` for the filters that are set, leaving out empty values. */
export function exportQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Downloads an export. `mutate(path)` fetches `path` (an API path with its filters) and saves
 * the file; `isPending` and `error` drive the button and its message.
 */
export function useDownload() {
  return useMutation({
    mutationFn: async (path) => {
      const { blob, filename } = await apiDownload(path);
      saveBlob(blob, filename);
    },
  });
}
