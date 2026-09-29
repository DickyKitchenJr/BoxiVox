import { Request, Response } from "express";
import { Instance } from "../models/instance.js";
import { User } from "../models/user.js";

const PRIMARY_INSTANCE_ID = "primary";

export const getInstance = async (req: Request, res: Response) => {
  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }

  res.status(200).json(instance);
};

export const updateInstance = async (req: Request, res: Response) => {
  const requester = req.user!;
  const body = req.body ?? {};
  const settingFields = ["passwordsRequired", "allowExternalAccess"];
  const allowedFields = [...settingFields, "adminPassword"];

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: `Unknown instance field: ${unknownFields[0]}`,
    });
  }

  for (const field of settingFields) {
    if (field in body && typeof body[field] !== "boolean") {
      return res.status(400).json({ error: `${field} must be a boolean` });
    }
  }

  const adminPassword = body.adminPassword;

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

  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }

  const passwordsRequired =
    body.passwordsRequired ?? instance.passwordsRequired;
  const allowExternalAccess =
    body.allowExternalAccess ?? instance.allowExternalAccess;

  if (allowExternalAccess && !passwordsRequired) {
    return res.status(400).json({
      error: "External access requires passwords",
    });
  }

  instance.passwordsRequired = passwordsRequired;
  instance.allowExternalAccess = allowExternalAccess;
  await instance.save();

  res.status(200).json(instance);
};
