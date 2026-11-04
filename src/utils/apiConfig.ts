/**
 * API configuration and native Capacitor server endpoint resolution.
 */

export const isCapacitor = (): boolean => {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform()
  );
};

export const getApiBaseUrl = (): string => {
  // Check localStorage if the user configured a custom server in Settings
  const custom = localStorage.getItem('MMM_API_SERVER_URL');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }

  // Build-time environment variable
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // If running inside Android Capacitor APK, default to the production backend
  if (isCapacitor()) {
    return 'https://ais-pre-77bhmhkxvu52nopsk7bxom-844589323095.asia-northeast1.run.app';
  }

  // In standard web browser mode, use relative path
  return '';
};

export const setApiBaseUrl = (url: string): void => {
  if (!url || !url.trim()) {
    localStorage.removeItem('MMM_API_SERVER_URL');
  } else {
    localStorage.setItem('MMM_API_SERVER_URL', url.trim().replace(/\/$/, ''));
  }
};

export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl();
  if (!base) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

export const apiFetch = (path: string, init?: RequestInit): Promise<Response> => {
  return fetch(apiUrl(path), init);
};
