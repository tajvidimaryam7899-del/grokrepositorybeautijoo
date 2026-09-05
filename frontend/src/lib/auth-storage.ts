const ACCESS_KEY = 'bj_access';
const REFRESH_KEY = 'bj_refresh';
const SUPER_ADMIN_KEY = 'bj_super_admin_active';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function isSuperAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SUPER_ADMIN_KEY) === 'true';
}

export function setSuperAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPER_ADMIN_KEY, 'true');
  localStorage.setItem(ACCESS_KEY, 'bj_super_admin_active_token');
  localStorage.setItem(REFRESH_KEY, 'bj_super_admin_refresh_token');
}

export function clearSuperAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPER_ADMIN_KEY);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SUPER_ADMIN_KEY);
}

