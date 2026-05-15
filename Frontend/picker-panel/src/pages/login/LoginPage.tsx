import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useLogin } from "../../features/auth/useLogin";
import { useSession } from "../../features/auth/sessionStore";

export function LoginPage() {
  const session = useSession();
  const mutation = useLogin();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  if (session?.token) {
    return <Navigate to="/orders" replace />;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      phone: phone.trim(),
      password: password.trim(),
    });
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={submit}>
        <div className="login-logo">⚡</div>
        <h1 className="login-title">Yuhher</h1>
        <p className="login-sub">Панель сборщика — авторизация</p>
        <label>
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="79640691596"
            autoComplete="username"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: 4 }}
          disabled={mutation.isPending || phone.trim() === "" || password.trim() === ""}
        >
          {mutation.isPending ? "Входим..." : "Войти"}
        </button>
        {mutation.isError ? (
          <p className="error-text">
            {mutation.error instanceof Error ? mutation.error.message : "Неверный телефон или пароль"}
          </p>
        ) : null}
      </form>
    </div>
  );
}
