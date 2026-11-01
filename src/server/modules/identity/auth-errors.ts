import type { Messages } from "@/i18n/messages";

export type AuthErrorKey = keyof Messages["auth"]["errors"];

/** Map Supabase Auth error codes to user-facing message keys. Never echo raw provider errors. */
export function authErrorKey(error: { code?: string; status?: number } | null | undefined): AuthErrorKey {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rateLimited";
    case "weak_password":
      return "weakPassword";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
    case "mfa_factor_not_found":
      return "invalidCode";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return "linkInvalid";
    default:
      return error?.status === 429 ? "rateLimited" : "generic";
  }
}
