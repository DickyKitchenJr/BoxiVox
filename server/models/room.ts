import { Schema, model } from "mongoose";

export interface IRoom {
  name: string;
  isPrivate?: boolean;
  occupants?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: [true, "Name is required"] },
    isPrivate: { type: Boolean, default: false },
    occupants: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Room = model<IRoom>("Room", roomSchema);
