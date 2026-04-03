import { beforeEach, describe, expect, it } from "vitest";
import { getSession, logout, setSession } from "./sessionStore";

describe("session store", () => {
  beforeEach(() => {
    localStorage.clear();
    logout();
  });

  it("stores and returns session", () => {
    setSession({
      token: "token",
      userId: "user",
      storeId: "store",
      role: "PICKER",
    });

    expect(getSession()).toEqual({
      token: "token",
      userId: "user",
      storeId: "store",
      role: "PICKER",
    });
  });

  it("clears session on logout", () => {
    setSession({
      token: "token",
      userId: "user",
      storeId: "store",
      role: "PICKER",
    });
    logout();
    expect(getSession()).toBeNull();
  });
});
