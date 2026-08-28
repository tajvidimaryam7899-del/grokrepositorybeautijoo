/** Matches backend AuthService response shapes */

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUserSummary = {
  id: string;
  phone: string | null;
  roles?: string[];
};

export type AuthLoginResponse = AuthTokens & {
  user: AuthUserSummary;
};

export type AuthRegisterResponse = AuthTokens & {
  user: { id: string; phone: string | null; roles?: string[] };
};

export type AuthMeResponse = {
  id: string;
  phone: string | null;
  email: string | null;
  status: string;
  phoneVerified: boolean;
  profile: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  roles: string[];
  professional: {
    id: string;
    slug: string;
    status: string;
    title?: string | null;
  } | null;
};

export type OtpRequestResponse = {
  message: string;
  expiresIn: number;
};

export type RegisterPayload = {
  phone: string;
  password: string;
  displayName?: string;
  /** Public registration: only customer | professional (backend validates) */
  role?: 'customer' | 'professional';
};

export type LoginPayload = {
  phone: string;
  password: string;
};

export type RequestOtpPayload = {
  phone: string;
  purpose?: string;
};

export type VerifyOtpPayload = {
  phone: string;
  code: string;
  purpose?: string;
};
