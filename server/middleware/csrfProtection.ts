import type { Request, RequestHandler } from "express";
import { csrfSync } from "csrf-sync";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const { csrfSynchronisedProtection, generateToken } = csrfSync();

export function createTrustedOriginProtection(
  trustedOrigin: string,
): RequestHandler {
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();

    const origin = req.get("origin");
    if (origin && origin !== trustedOrigin) {
      return res.status(403).json({ error: "Untrusted request origin" });
    }

    next();
  };
}

export const csrfProtection: RequestHandler = (req, res, next) => {
  csrfSynchronisedProtection(req, res, (error?: unknown) => {
    if (!error) return next();

    if ((error as { code?: string }).code === "EBADCSRFTOKEN") {
      return res.status(403).json({ error: "Invalid or missing CSRF token" });
    }

    next(error);
  });
};

export function generateCsrfToken(req: Request): string {
  return generateToken(req);
}