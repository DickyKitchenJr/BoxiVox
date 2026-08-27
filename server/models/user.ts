import { Schema, model } from "mongoose";

export interface IUser {
  name: string;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,
      trim: true,
    },
    password: { type: String },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);
