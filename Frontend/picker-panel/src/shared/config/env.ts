function getApiBaseUrl(): string {
  return window.location.origin;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
};
