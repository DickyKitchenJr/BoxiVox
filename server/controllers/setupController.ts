import { Request, Response } from "express";
import { Instance } from "../models/instance.js";
import { User } from "../models/user.js";

const PRIMARY_INSTANCE_ID = "primary";

export const completeSetup = async (req: Request, res: Response) => {
  const setup = req.body ?? {};
  const allowedFields = [
    "adminName",
    "adminPassword",
    "passwordsRequired",
    "allowExternalAccess",
  ];
  const unknownFields = Object.keys(setup).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: `Unknown setup field: ${unknownFields[0]}`,
    });
  }

  const existingInstance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (existingInstance) {
    return res.status(409).json({ error: "Setup has already started" });
  }

  if (typeof setup.adminName !== "string") {
    return res.status(400).json({ error: "Admin name must be a string" });
  }

  const adminName = setup.adminName.trim();

  if (!adminName) {
    return res.status(400).json({ error: "Admin name is required" });
  }

  if (typeof setup.adminPassword !== "string" || !setup.adminPassword.trim()) {
    return res.status(400).json({ error: "Admin password is required" });
  }

  const passwordsRequired = setup.passwordsRequired ?? true;
  const allowExternalAccess = setup.allowExternalAccess ?? false;

  if (typeof passwordsRequired !== "boolean") {
    return res
      .status(400)
      .json({ error: "passwordsRequired must be a boolean" });
  }

  if (typeof allowExternalAccess !== "boolean") {
    return res
      .status(400)
      .json({ error: "allowExternalAccess must be a boolean" });
  }

  if (allowExternalAccess && !passwordsRequired) {
    return res.status(400).json({
      error: "External access requires passwords",
    });
  }

  const existingAdmin = await User.findOne({ name: adminName });

  if (existingAdmin) {
    return res.status(409).json({ error: "Username is already in use" });
  }

  let adminUser: InstanceType<typeof User> | undefined;

  try {
    adminUser = await User.create({
      name: adminName,
      password: setup.adminPassword,
      isAdmin: true,
    });

    const instance = await Instance.create({
      _id: PRIMARY_INSTANCE_ID,
      setupCompleted: true,
      adminUserId: adminUser._id,
      passwordsRequired,
      allowExternalAccess,
    });

    res.status(201).json({
      instance,
      admin: {
        _id: adminUser._id,
        name: adminUser.name,
        isAdmin: adminUser.isAdmin,
      },
    });
  } catch (error) {
    if (adminUser) {
      await User.deleteOne({ _id: adminUser._id });
    }

    throw error;
  }
};
