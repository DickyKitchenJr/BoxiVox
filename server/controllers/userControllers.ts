import { Request, Response } from "express";
import { User } from "../models/user.js";

// Create
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

  if (existingUser && existingUser._id.toString() !== req.params.id) {
    res.status(409);
    throw new Error("Username is already in use");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
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
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.status(200).json({ message: "User deleted successfully" });
};
