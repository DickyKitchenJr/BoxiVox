import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ error: message });
};
