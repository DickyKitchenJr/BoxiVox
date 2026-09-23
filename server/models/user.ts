import argon2 from "argon2";
import { Schema, model } from "mongoose";

export interface IUser {
  name: string;
  password?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,
      trim: true,
    },
    password: { type: String, select: false },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.pre("validate", function () {
  if (
    this.isAdmin &&
    (typeof this.password !== "string" || !this.password.trim())
  ) {
    throw new Error("Admins must have a password");
  }
});

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  this.password = await argon2.hash(this.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
});

userSchema.methods.comparePassword = function (candidate: string) {
  if (!this.password) {
    return Promise.resolve(false);
  }

  return argon2.verify(this.password, candidate);
};

export const User = model<IUser>("User", userSchema);
