import { Request, Response } from "express";
import { User } from "../models/user.js";

export const createUser = async (req: Request, res: Response) => {
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

  const existingUser = await User.findOne({ name });

  if (existingUser) {
    res.status(409);
    throw new Error("Username is already in use");
  }

  const user = await User.create(req.body);
  res.status(201).json(user);
};

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
