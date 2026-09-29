import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.js";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await User.findById(userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Authentication required" });
  }

  req.user = user;
  next();
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};
