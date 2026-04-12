import axios from "axios";

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  return `http://${window.location.hostname}:8080`;
}

export const apiBaseUrl = getApiBaseUrl();

export const publicClient = axios.create({
  baseURL: `${apiBaseUrl}/api/v1`,
});

export const createAdminClient = (user: string, password: string) => {
  const token = btoa(`${user}:${password}`);
  return axios.create({
    baseURL: `${apiBaseUrl}/api/v1/admin`,
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
  });
};
