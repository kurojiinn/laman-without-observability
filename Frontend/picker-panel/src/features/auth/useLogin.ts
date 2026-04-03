import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginPicker, type LoginInput } from "./api";
import { setSession } from "./sessionStore";

export function useLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: LoginInput) => loginPicker(input),
    onSuccess: (data) => {
      setSession({
        token: data.token,
        userId: data.user_id,
        storeId: data.store_id,
        role: data.role,
      });
      navigate("/orders", { replace: true });
    },
  });
}
