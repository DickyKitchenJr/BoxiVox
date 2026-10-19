import { Request, Response } from "express";
import { Types } from "mongoose";
import { checkForBannedWords } from "../../shared/bannedInputs.js";
import { Message } from "../models/message.js";
import { Room } from "../models/room.js";
import { broadcastRoomMessage } from "../realtime/socketServer.js";
import { canPostToRoom, canReadRoom } from "../services/roomAccess.js";
import { reserveMessageCreation } from "../middleware/rateLimiters.js";

const DEFAULT_HISTORY_LIMIT = 150;
const MAX_HISTORY_LIMIT = 300;
const MAX_MESSAGE_CHARACTERS = 9000;

function validObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function serializeMessage(message: InstanceType<typeof Message>) {
  return {
    id: message._id.toString(),
    senderID: message.senderID,
    content: message.content,
    roomID: message.roomID,
    expiresAt: message.expiresAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export const getRoomMessages = async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (typeof roomId !== "string" || !validObjectId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }

  const requester = req.user!;
  const room = await Room.findById(roomId);
  if (
    !room ||
    !canReadRoom(room, {
      id: requester._id.toString(),
      isAdmin: requester.isAdmin,
    })
  ) {
    return res.status(404).json({ error: "Room not found" });
  }

  let limit = DEFAULT_HISTORY_LIMIT;
  if (req.query.limit !== undefined) {
    const parsedLimit = Number(req.query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ error: "Invalid message limit" });
    }
    limit = Math.min(parsedLimit, MAX_HISTORY_LIMIT);
  }

  const before = req.query.before;
  if (
    before !== undefined &&
    (typeof before !== "string" || !validObjectId(before))
  ) {
    return res.status(400).json({ error: "Invalid message cursor" });
  }

  const query: {
    roomID: string;
    expiresAt: { $gt: Date };
    _id?: { $lt: Types.ObjectId };
  } = {
    roomID: roomId,
    expiresAt: { $gt: new Date() },
  };
  if (typeof before === "string") {
    query._id = { $lt: new Types.ObjectId(before) };
  }

  const fetchedMessages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1);
  const hasMore = fetchedMessages.length > limit;
  const pageMessages = fetchedMessages.slice(0, limit).reverse();
  const messages = pageMessages.map(serializeMessage);
  const nextCursor = hasMore ? pageMessages[0]._id.toString() : null;

  res.status(200).json({
    messages,
    pagination: { hasMore, nextCursor },
  });
};

export const createRoomMessage = async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (typeof roomId !== "string" || !validObjectId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }

  const rawContent = req.body?.content;
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const content = rawContent.trim();
  if (content.length > MAX_MESSAGE_CHARACTERS) {
    return res.status(413).json({ error: "Message is too long" });
  }

  const requester = req.user!;
  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  if (
    !canPostToRoom(room, {
      id: requester._id.toString(),
      isAdmin: requester.isAdmin,
    })
  ) {
    return res.status(403).json({ error: "Room membership required" });
  }

  if (
    room.rules.includes("explicit-language-filter") &&
    checkForBannedWords(content)
  ) {
    return res.status(422).json({
      error: "Message was rejected by this room's language rule",
      code: "ROOM_RULE_REJECTED",
    });
  }

  const reservation = reserveMessageCreation(requester._id.toString());
  if (!reservation.allowed) {
    res.setHeader("Retry-After", reservation.retryAfterSeconds);
    return res
      .status(429)
      .json({ error: "Too many messages sent. Try again later." });
  }

  try {
    const message = await Message.create({
      senderID: requester._id.toString(),
      content,
      roomID: room._id.toString(),
    });
    const responseMessage = serializeMessage(message);

    broadcastRoomMessage(room._id.toString(), responseMessage);
    return res.status(201).json(responseMessage);
  } catch (error) {
    reservation.release();
    throw error;
  }
};
