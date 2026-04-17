// In-memory token store. Не в localStorage/sessionStorage — не читается через XSS.
// Теряется при перезагрузке страницы — сессия восстанавливается через httpOnly cookie + /auth/me.
let _token: string | null = null;

export const tokenStore = {
  set(t: string) { _token = t; },
  get(): string | null { return _token; },
  clear() { _token = null; },
};
