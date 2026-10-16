// src/features/auth/types.ts
export interface LoginFormData {
  email: string;
  password: string;
}

export interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}
