// Public auth service: re-exports the auth modules. Routes import this file only.
// Holds no logic; each job lives in its own auth.<job>.ts file in this folder.

export { register } from "./auth.register.js";
export { login } from "./auth.login.js";
export { verifyEmail } from "./auth.verify.js";
export { resendVerification } from "./auth.resend.js";
export { googleSignIn } from "./auth.google.js";
export { getProfile, updateProfile } from "./auth.profile.js";
export type { RegisterInput, RegisterResult, UpdateProfileInput } from "./auth.utils.js";
