import { Schema, Types, model } from "mongoose";

export const ROOM_RULES = ["explicit-language-filter"] as const;
export type RoomRule = (typeof ROOM_RULES)[number];

export interface IRoom {
  name: string;
  normalizedName: string;
  isPrivate: boolean;
  createdBy: Types.ObjectId;
  memberIds: Types.ObjectId[];
  rules: RoomRule[];
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    normalizedName: { type: String, required: true, select: false },
    isPrivate: { type: Boolean, default: false },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    rules: [{ type: String, enum: ROOM_RULES }],
  },
  { timestamps: true },
);

roomSchema.index({ normalizedName: 1 }, { unique: true });

roomSchema.pre("validate", function () {
  this.name = this.name.trim();
  this.normalizedName = normalizeRoomName(this.name);
});

export function normalizeRoomName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export const Room = model<IRoom>("Room", roomSchema);
