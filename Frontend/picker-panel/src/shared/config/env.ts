function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  return `http://${window.location.hostname}:8080`;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
};
