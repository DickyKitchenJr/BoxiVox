import { Request, Response } from "express";
import { Instance } from "../models/instance.js";
import { User } from "../models/user.js";

const PRIMARY_INSTANCE_ID = "primary";

function sanitizeUser(user: { _id: unknown; name: string; isAdmin: boolean }) {
  return {
    _id: user._id,
    name: user.name,
    isAdmin: user.isAdmin,
  };
}

function destroySession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Sign in according to the instance's current password policy
export const login = async (req: Request, res: Response) => {
  const rawName = req.body?.name;

  if (typeof rawName !== "string") {
    return res.status(400).json({ error: "Name must be a string" });
  }

  const name = rawName.trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(500).json({ error: "Instance is not configured" });
  }

  const user = await User.findOne({ name }).select("+password");

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (instance.passwordsRequired) {
    if (!user.password) {
      return res.status(409).json({
        error: "Password setup required",
        code: "PASSWORD_SETUP_REQUIRED",
      });
    }

    const password = req.body?.password;

    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ error: "Password is required" });
    }

    const validPassword = await user.comparePassword(password);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
  }

  // Regenerate the session before assigning identity to prevent session fixation
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  req.session.userId = user._id.toString();

  res.status(200).json({ user: sanitizeUser(user) });
};

export const logout = async (req: Request, res: Response) => {
  await destroySession(req);
  res.clearCookie("boxivox.sid");
  res.status(200).json({ message: "Logged out successfully" });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await User.findById(userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Authentication required" });
  }

  res.status(200).json({ user: sanitizeUser(user) });
};

// Let an existing passwordless user create their first password once passwords are required
export const claimPassword = async (req: Request, res: Response) => {
  const rawName = req.body?.name;

  if (typeof rawName !== "string") {
    return res.status(400).json({ error: "Name must be a string" });
  }

  const name = rawName.trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const password = req.body?.password;

  if (typeof password !== "string" || !password.trim()) {
    return res.status(400).json({ error: "Password is required" });
  }

  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(500).json({ error: "Instance is not configured" });
  }

  if (!instance.passwordsRequired) {
    return res
      .status(400)
      .json({ error: "Passwords are not required for this instance" });
  }

  const user = await User.findOne({ name }).select("+password");

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.password) {
    return res.status(409).json({
      error: "Password already set. Use change password instead.",
    });
  }

  user.password = password;
  await user.save();

  res.status(200).json({ message: "Password created successfully" });
};

// Let a signed-in user replace an already-existing password
export const changePassword = async (req: Request, res: Response) => {
  const requester = req.user!;

  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;

  if (typeof currentPassword !== "string" || !currentPassword.trim()) {
    return res.status(400).json({ error: "Current password is required" });
  }

  if (typeof newPassword !== "string" || !newPassword.trim()) {
    return res.status(400).json({ error: "New password is required" });
  }

  const user = await User.findById(requester._id).select("+password");

  if (!user || !user.password) {
    return res.status(409).json({
      error: "No password set. Use password setup instead.",
    });
  }

  const validCurrentPassword = await user.comparePassword(currentPassword);

  if (!validCurrentPassword) {
    return res.status(401).json({ error: "Invalid current password" });
  }

  user.password = newPassword;
  await user.save();

  await destroySession(req);
  res.clearCookie("boxivox.sid");
  res.status(200).json({ message: "Password changed successfully" });
};
