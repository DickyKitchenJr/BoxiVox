import { Request, Response } from "express";
import { Types } from "mongoose";
import { Message } from "../models/message.js";
import {
  normalizeRoomName,
  ROOM_RULES,
  Room,
  RoomRule,
} from "../models/room.js";
import { User } from "../models/user.js";

const allowedRules = new Set<string>(ROOM_RULES);

function roomResponse(room: InstanceType<typeof Room>) {
  return {
    id: room._id.toString(),
    name: room.name,
    isPrivate: room.isPrivate,
    createdBy: room.createdBy.toString(),
    memberIds: room.memberIds.map((memberId) => memberId.toString()),
    rules: room.rules,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function validId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function canViewRoom(
  room: InstanceType<typeof Room>,
  user: NonNullable<Request["user"]>,
): boolean {
  return (
    !room.isPrivate ||
    user.isAdmin ||
    room.memberIds.some((memberId) => memberId.equals(user._id))
  );
}

export const getRooms = async (req: Request, res: Response) => {
  const requester = req.user!;
  const filter = requester.isAdmin
    ? {}
    : {
        $or: [
          { isPrivate: false },
          { memberIds: requester._id },
        ],
      };
  const rooms = await Room.find(filter).sort({ name: 1 });

  res.status(200).json(rooms.map(roomResponse));
};

export const getRoom = async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (typeof roomId !== "string" || !validId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }

  const room = await Room.findById(roomId);
  if (!room || !canViewRoom(room, req.user!)) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.status(200).json(roomResponse(room));
};

export const createRoom = async (req: Request, res: Response) => {
  const rawName = req.body?.name;
  if (typeof rawName !== "string" || !rawName.trim()) {
    return res.status(400).json({ error: "A room name is required" });
  }

  if (typeof req.body?.isPrivate !== "boolean") {
    return res
      .status(400)
      .json({ error: "Room privacy must be selected" });
  }

  const rules = req.body?.rules ?? [];
  if (
    !Array.isArray(rules) ||
    rules.some((rule) => typeof rule !== "string" || !allowedRules.has(rule))
  ) {
    return res.status(400).json({ error: "One or more room rules are invalid" });
  }

  const name = rawName.trim();
  const normalizedName = normalizeRoomName(name);
  const existingRoom = await Room.findOne({ normalizedName });
  if (existingRoom) {
    return res.status(409).json({ error: "A room with that name already exists" });
  }

  try {
    const room = await Room.create({
      name,
      normalizedName,
      isPrivate: req.body.isPrivate,
      createdBy: req.user!._id,
      memberIds: req.body.isPrivate ? [req.user!._id] : [],
      rules: [...new Set(rules)] as RoomRule[],
    });

    return res.status(201).json(roomResponse(room));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ error: "A room with that name already exists" });
    }

    throw error;
  }
};

export const inviteRoomMember = async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  const memberId = req.body?.userId;

  if (typeof roomId !== "string" || !validId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }
  if (typeof memberId !== "string" || !validId(memberId)) {
    return res.status(400).json({ error: "A valid user ID is required" });
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  if (!room.isPrivate) {
    return res
      .status(400)
      .json({ error: "Public rooms do not have an invite list" });
  }
  if (!room.memberIds.some((id) => id.equals(req.user!._id))) {
    return res.status(403).json({ error: "Room membership required" });
  }

  const member = await User.findById(memberId);
  if (!member) {
    return res.status(404).json({ error: "User not found" });
  }
  if (room.memberIds.some((id) => id.equals(member._id))) {
    return res.status(409).json({ error: "User is already a room member" });
  }

  room.memberIds.push(member._id);
  await room.save();

  res.status(200).json(roomResponse(room));
};

export const deleteRoom = async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (typeof roomId !== "string" || !validId(roomId)) {
    return res.status(400).json({ error: "Invalid room ID" });
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const requester = req.user!;
  if (!requester.isAdmin && !room.createdBy.equals(requester._id)) {
    return res.status(403).json({ error: "Not authorized to delete this room" });
  }

  await Message.deleteMany({ roomID: room._id.toString() });
  await room.deleteOne();

  res.status(200).json({ message: "Room deleted successfully" });
};