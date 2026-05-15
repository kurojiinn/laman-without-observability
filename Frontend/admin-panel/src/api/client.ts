import axios from "axios";

function getApiBaseUrl(): string {
  return window.location.origin;
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
