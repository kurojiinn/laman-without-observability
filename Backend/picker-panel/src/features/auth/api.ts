import { z } from "zod";
import { httpRequest } from "../../shared/api/http";

export type LoginInput = {
  phone: string;
  password: string;
};

const loginResponseSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().uuid(),
  store_id: z.string().uuid().nullable(),
  role: z.string(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export async function loginPicker(payload: LoginInput): Promise<LoginResponse> {
  const data = await httpRequest<unknown>("/api/v1/picker/auth/login", {
    method: "POST",
    body: payload,
  });
  return loginResponseSchema.parse(data);
}
