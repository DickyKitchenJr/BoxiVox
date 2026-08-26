import { Schema, model } from "mongoose";

const DEFAULT_EXPIRY_MILLISECONDS = 24 * 60 * 60 * 1000; // 24 hours

export interface IMessage {
  senderID: string;
  content: string;
  roomID: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    senderID: { type: String, required: [true, "Sender is required"] },
    content: { type: String, required: [true, "Content is required"] },
    roomID: { type: String, required: [true, "Room is required"] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + DEFAULT_EXPIRY_MILLISECONDS),
    },
  },
  { timestamps: true },
);

// Time-To-Live index
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Message = model<IMessage>("Message", messageSchema);
