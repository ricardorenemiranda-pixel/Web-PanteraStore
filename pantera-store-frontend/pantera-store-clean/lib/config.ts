/** URL base del backend (pantera-store-backend). Configurable vía .env.local. */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export const STEAM_LOGIN_URL = `${BACKEND_URL}/auth/steam`;
