import { Request, Response } from "express";
import { Instance } from "../models/instance.js";
import { User } from "../models/user.js";

// Create
export const createUser = async (req: Request, res: Response) => {
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "isAdmin")) {
    res.status(400);
    throw new Error("isAdmin cannot be set when creating a regular user");
  }

  const rawName = req.body?.name;

  if (typeof rawName !== "string") {
    res.status(400);
    throw new Error("Name must be a string");
  }

  const name = rawName.trim();

  if (!name) {
    res.status(400);
    throw new Error("Name is required");
  }

  const instance = await Instance.findById("primary");

  if (!instance) {
    res.status(500);
    throw new Error("Instance is not configured");
  }

  const password = req.body?.password;

  if (
    instance.passwordsRequired &&
    (typeof password !== "string" || !password.trim())
  ) {
    res.status(400);
    throw new Error("Password is required");
  }

  const existingUser = await User.findOne({ name });

  if (existingUser) {
    res.status(409);
    throw new Error("Username is already in use");
  }

  const user = await User.create({
    name,
    password,
    isAdmin: false,
  });
  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(201).json(userResponse);
};

// Read/Get
export const getUsers = async (req: Request, res: Response) => {
  const users = await User.find();

  res.status(200).json(users);
};

export const getSpecificUser = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.status(200).json(user);
};

// Update
export const updateUser = async (req: Request, res: Response) => {
  const requester = req.user!;
  const targetId = req.params.id;
  const isSelf = requester._id.toString() === targetId;

  if (!isSelf && !requester.isAdmin) {
    return res
      .status(403)
      .json({ error: "Not authorized to update this user" });
  }

  const rawName = req.body?.name;

  if (typeof rawName !== "string") {
    res.status(400);
    throw new Error("Name must be a string");
  }

  const name = rawName.trim();

  if (!name) {
    res.status(400);
    throw new Error("Name is required");
  }

  if (requester.isAdmin) {
    const adminPassword = req.body?.adminPassword;

    if (typeof adminPassword !== "string" || !adminPassword.trim()) {
      return res
        .status(400)
        .json({ error: "Admin password confirmation is required" });
    }

    const admin = await User.findById(requester._id).select("+password");
    const validAdminPassword = await admin?.comparePassword(adminPassword);

    if (!admin || !validAdminPassword) {
      return res.status(401).json({ error: "Invalid admin password" });
    }
  } else {
    const targetUser = await User.findById(targetId).select("+password");

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.password) {
      const currentPassword = req.body?.currentPassword;

      if (typeof currentPassword !== "string" || !currentPassword.trim()) {
        return res.status(400).json({ error: "Current password is required" });
      }

      const validPassword = await targetUser.comparePassword(currentPassword);

      if (!validPassword) {
        return res.status(401).json({ error: "Invalid current password" });
      }
    }
  }

  const existingUser = await User.findOne({ name });

  if (existingUser && existingUser._id.toString() !== targetId) {
    res.status(409);
    throw new Error("Username is already in use");
  }

  const user = await User.findByIdAndUpdate(
    targetId,
    { name },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.status(200).json(user);
};

// Delete
export const deleteUser = async (req: Request, res: Response) => {
  const requester = req.user!;

  const adminPassword = req.body?.adminPassword;

  if (typeof adminPassword !== "string" || !adminPassword.trim()) {
    return res
      .status(400)
      .json({ error: "Admin password confirmation is required" });
  }

  const admin = await User.findById(requester._id).select("+password");
  const validAdminPassword = await admin?.comparePassword(adminPassword);

  if (!admin || !validAdminPassword) {
    return res.status(401).json({ error: "Invalid admin password" });
  }

  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (targetUser.isAdmin) {
    return res
      .status(400)
      .json({ error: "Admin accounts cannot be deleted through this route" });
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({ message: "User deleted successfully" });
};
