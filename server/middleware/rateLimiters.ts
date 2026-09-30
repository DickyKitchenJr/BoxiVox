import { rateLimit } from "express-rate-limit";

const fifteenMinutes = 15 * 60 * 1000;

export const loginLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many failed login attempts. Try again in 15 minutes." },
});

export const claimPasswordLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed password claims. Try again in 15 minutes.",
  },
});

export const passwordConfirmationLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed password confirmations. Try again in 15 minutes.",
  },
});

export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Try again in an hour." },
});
