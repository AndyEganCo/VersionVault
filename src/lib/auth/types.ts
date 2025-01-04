export type UserMetadata = {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  company?: string;
  role?: string;
};

export type AuthError = {
  message: string;
  status?: number;
};