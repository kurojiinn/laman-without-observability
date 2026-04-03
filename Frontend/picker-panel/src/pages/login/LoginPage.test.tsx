import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";

const mutate = vi.fn();

vi.mock("../../features/auth/useLogin", () => ({
  useLogin: () => ({
    mutate,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("../../features/auth/sessionStore", () => ({
  useSession: () => null,
}));

describe("LoginPage", () => {
  it("submits phone and password", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("79640691596"), "79640000000");
    await userEvent.type(screen.getByPlaceholderText("******"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(mutate).toHaveBeenCalledWith({
      phone: "79640000000",
      password: "secret",
    });
  });
});
