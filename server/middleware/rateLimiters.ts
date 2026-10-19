import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

const fifteenMinutes = 15 * 60 * 1000;

interface MessageCreationWindow {
  startedAt: number;
  count: number;
}

export interface MessageCreationReservation {
  allowed: boolean;
  retryAfterSeconds: number;
  release: () => void;
}

function userRateLimitKey(req: Request) {
  return req.user!._id.toString();
}

export function createLoginLimiter(limit = 50) {
  return rateLimit({
    windowMs: fifteenMinutes,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: "Too many failed login attempts. Try again in 15 minutes.",
    },
  });
}

export const loginLimiter = createLoginLimiter();

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

export function createRoomCreationLimiter(limit = 10) {
  return rateLimit({
    windowMs: fifteenMinutes,
    limit,
    keyGenerator: userRateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many rooms created. Try again in 15 minutes.",
    },
  });
}

export const roomCreationLimiter = createRoomCreationLimiter();

export function createMessageCreationAllowance(
  limit = 70,
  windowMs = 60 * 1000,
) {
  const windows = new Map<string, MessageCreationWindow>();

  return function reserveMessageCreation(
    userId: string,
    now = Date.now(),
  ): MessageCreationReservation {
    let window = windows.get(userId);
    if (!window || now >= window.startedAt + windowMs) {
      window = { startedAt: now, count: 0 };
      windows.set(userId, window);
    }

    if (window.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.startedAt + windowMs - now) / 1000),
        ),
        release: () => {},
      };
    }

    window.count += 1;
    const reservedWindow = window;

    return {
      allowed: true,
      retryAfterSeconds: 0,
      release: () => {
        const currentWindow = windows.get(userId);
        if (currentWindow === reservedWindow && currentWindow.count > 0) {
          currentWindow.count -= 1;
        }
      },
    };
  };
}

export const reserveMessageCreation = createMessageCreationAllowance();

export function createFailedMessageLimiter(limit = 30) {
  return rateLimit({
    windowMs: fifteenMinutes,
    limit,
    keyGenerator: userRateLimitKey,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 422,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Too many messages blocked by room rules. Try again in 15 minutes.",
    },
  });
}
