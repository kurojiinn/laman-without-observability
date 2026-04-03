export type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: ApiErrorPayload
  ) {
    super(message);
  }
}
