import type { Request, Response } from "express";
import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Message } from "../models/message.js";
import { Room } from "../models/room.js";
import { User } from "../models/user.js";
import {
  createRoom,
  deleteRoom,
  getRooms,
  inviteRoomMember,
} from "./roomController.js";

function makeRequest(
  user: { _id: Types.ObjectId; isAdmin: boolean },
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
): Request {
  return { user, body, params } as unknown as Request;
}

function makeResponse(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response;
}

function makeRoom(
  createdBy: Types.ObjectId,
  memberIds: Types.ObjectId[],
  isPrivate = true,
) {
  return {
    _id: new Types.ObjectId(),
    name: "Room",
    normalizedName: "room",
    isPrivate,
    createdBy,
    memberIds,
    rules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
  } as unknown as InstanceType<typeof Room>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("room controller", () => {
  it("lists public rooms and only private rooms the user belongs to", async () => {
    const userId = new Types.ObjectId();
    const sort = vi.fn().mockResolvedValue([]);
    vi.spyOn(Room, "find").mockReturnValue({ sort } as never);
    const response = makeResponse();

    await getRooms(makeRequest({ _id: userId, isAdmin: false }), response);

    expect(Room.find).toHaveBeenCalledWith({
      $or: [{ isPrivate: false }, { memberIds: userId }],
    });
    expect(sort).toHaveBeenCalledWith({ name: 1 });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("rejects room rules that are not supported", async () => {
    const findOne = vi.spyOn(Room, "findOne");
    const response = makeResponse();

    await createRoom(
      makeRequest(
        { _id: new Types.ObjectId(), isAdmin: false },
        { name: "Room", isPrivate: false, rules: ["unknown-rule"] },
      ),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "One or more room rules are invalid",
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it("lets an existing private-room member invite another user", async () => {
    const requesterId = new Types.ObjectId();
    const targetId = new Types.ObjectId();
    const room = makeRoom(requesterId, [requesterId]);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    vi.spyOn(User, "findById").mockResolvedValue({ _id: targetId } as never);
    const response = makeResponse();

    await inviteRoomMember(
      makeRequest(
        { _id: requesterId, isAdmin: false },
        { userId: targetId.toString() },
        { roomId: room._id.toString() },
      ),
      response,
    );

    expect(room.memberIds).toContainEqual(targetId);
    expect(room.save).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("prevents non-creators from deleting rooms", async () => {
    const creatorId = new Types.ObjectId();
    const requesterId = new Types.ObjectId();
    const room = makeRoom(creatorId, [creatorId]);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    const deleteMessages = vi.spyOn(Message, "deleteMany");
    const response = makeResponse();

    await deleteRoom(
      makeRequest(
        { _id: requesterId, isAdmin: false },
        {},
        { roomId: room._id.toString() },
      ),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(deleteMessages).not.toHaveBeenCalled();
    expect(room.deleteOne).not.toHaveBeenCalled();
  });

  it("deletes room messages when its creator deletes the room", async () => {
    const creatorId = new Types.ObjectId();
    const room = makeRoom(creatorId, [creatorId]);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    const deleteMessages = vi
      .spyOn(Message, "deleteMany")
      .mockResolvedValue({ acknowledged: true, deletedCount: 2 } as never);
    const response = makeResponse();

    await deleteRoom(
      makeRequest(
        { _id: creatorId, isAdmin: false },
        {},
        { roomId: room._id.toString() },
      ),
      response,
    );

    expect(deleteMessages).toHaveBeenCalledWith({ roomID: room._id.toString() });
    expect(room.deleteOne).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
  });
});