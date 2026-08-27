import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(statusCode).json({ error: message });
};
