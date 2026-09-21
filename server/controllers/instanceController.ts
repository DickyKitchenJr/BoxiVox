import { Request, Response } from "express";
import { Instance } from "../models/instance.js";

const PRIMARY_INSTANCE_ID = "primary";

export const getInstance = async (req: Request, res: Response) => {
  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }

  res.status(200).json(instance);
};

export const updateInstance = async (req: Request, res: Response) => {
  const updates = req.body ?? {};
  const allowedFields = ["passwordsRequired", "allowExternalAccess"];
  const unknownFields = Object.keys(updates).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: `Unknown instance field: ${unknownFields[0]}`,
    });
  }

  for (const field of ["passwordsRequired", "allowExternalAccess"]) {
    if (field in updates && typeof updates[field] !== "boolean") {
      return res.status(400).json({ error: `${field} must be a boolean` });
    }
  }

  const instance = await Instance.findById(PRIMARY_INSTANCE_ID);

  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }

  const passwordsRequired =
    updates.passwordsRequired ?? instance.passwordsRequired;
  const allowExternalAccess =
    updates.allowExternalAccess ?? instance.allowExternalAccess;

  if (allowExternalAccess && !passwordsRequired) {
    return res.status(400).json({
      error: "External access requires passwords",
    });
  }

  Object.assign(instance, updates);
  await instance.save();

  res.status(200).json(instance);
};
