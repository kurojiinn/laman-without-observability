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
      <form className="card login-form" onSubmit={submit}>
        <h1>Панель сборщика</h1>
        <p className="subtitle">Авторизация сотрудника магазина</p>
        <label>
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="79640691596"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="******"
          />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending || phone.trim() === "" || password.trim() === ""}
        >
          {mutation.isPending ? "Входим..." : "Войти"}
        </button>
        {mutation.isError ? (
          <p className="error-text">{mutation.error instanceof Error ? mutation.error.message : "Ошибка"}</p>
        ) : null}
      </form>
    </div>
  );
}
