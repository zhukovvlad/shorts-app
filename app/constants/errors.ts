/**
 * Authentication error messages.
 * Centralized error messages for better maintainability and future i18n support.
 * 
 * TODO: Replace with i18n library (e.g., next-intl, react-i18next) for multi-language support.
 */
export const AUTH_ERRORS = {
  SIGN_IN_FAILED: "Не удалось войти. Пожалуйста, попробуйте еще раз.",
  GENERIC_ERROR: "Произошла ошибка при входе. Пожалуйста, попробуйте позже.",
  UNEXPECTED_RESULT: "Произошла неожиданная ошибка. Пожалуйста, попробуйте еще раз.",
} as const;
