import axios from "axios";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://192.168.0.14:8080";

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
