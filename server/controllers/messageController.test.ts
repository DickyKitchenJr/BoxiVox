import type { Request, Response } from "express";
import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bannedWords } from "../../shared/bannedInputs.js";
import { Message } from "../models/message.js";
import { Room } from "../models/room.js";
import { createRoomMessage, getRoomMessages } from "./messageController.js";

const { broadcastRoomMessage } = vi.hoisted(() => ({
  broadcastRoomMessage: vi.fn(),
}));

vi.mock("../realtime/socketServer.js", () => ({ broadcastRoomMessage }));

function makeRequest(
  userId: Types.ObjectId,
  content: string,
  roomId: string,
): Request {
  return {
    user: { _id: userId, isAdmin: false },
    body: { content },
    params: { roomId },
  } as unknown as Request;
}

function makeResponse(): Response {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response;
}

function makeRoom(
  userId: Types.ObjectId,
  rules: string[] = [],
  isPrivate = true,
) {
  return {
    _id: new Types.ObjectId(),
    isPrivate,
    memberIds: isPrivate ? [userId] : [],
    rules,
  } as unknown as InstanceType<typeof Room>;
}

async function expectHistoryFetchLimit(
  query: Record<string, unknown>,
  expectedFetchLimit: number,
) {
  const userId = new Types.ObjectId();
  const room = makeRoom(userId);
  vi.spyOn(Room, "findById").mockResolvedValue(room as never);
  const limit = vi.fn().mockResolvedValue([]);
  const sort = vi.fn().mockReturnValue({ limit });
  vi.spyOn(Message, "find").mockReturnValue({ sort } as never);
  const req = {
    user: { _id: userId, isAdmin: false },
    params: { roomId: room._id.toString() },
    query,
  } as unknown as Request;

  await getRoomMessages(req, makeResponse());

  expect(limit).toHaveBeenCalledWith(expectedFetchLimit);
}

afterEach(() => {
  vi.restoreAllMocks();
  broadcastRoomMessage.mockReset();
});

describe("message controller", () => {
  it("uses the agreed default history page size", async () => {
    await expectHistoryFetchLimit({}, 151);
  });

  it("caps a requested history page at the agreed maximum", async () => {
    await expectHistoryFetchLimit({ limit: "999" }, 301);
  });

  it("returns history messages with an older-page cursor when more exist", async () => {
    const userId = new Types.ObjectId();
    const room = makeRoom(userId);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);

    const oldestFetchedMessage = {
      _id: new Types.ObjectId(),
      senderID: userId.toString(),
      content: "older",
      roomID: room._id.toString(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newestReturnedMessage = {
      ...oldestFetchedMessage,
      _id: new Types.ObjectId(),
      content: "newer",
    };
    const lookaheadMessage = {
      ...oldestFetchedMessage,
      _id: new Types.ObjectId(),
      content: "lookahead",
    };
    const limit = vi
      .fn()
      .mockResolvedValue([
        newestReturnedMessage,
        oldestFetchedMessage,
        lookaheadMessage,
      ]);
    const sort = vi.fn().mockReturnValue({ limit });
    vi.spyOn(Message, "find").mockReturnValue({ sort } as never);

    const response = makeResponse();
    const req = {
      user: { _id: userId, isAdmin: false },
      params: { roomId: room._id.toString() },
      query: { limit: "2" },
    } as unknown as Request;

    await getRoomMessages(req, response);

    expect(limit).toHaveBeenCalledWith(3);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({ id: oldestFetchedMessage._id.toString() }),
        expect.objectContaining({ id: newestReturnedMessage._id.toString() }),
      ],
      pagination: {
        hasMore: true,
        nextCursor: oldestFetchedMessage._id.toString(),
      },
    });
  });

  it("returns a null cursor when history is exhausted", async () => {
    const userId = new Types.ObjectId();
    const room = makeRoom(userId);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);

    const message = {
      _id: new Types.ObjectId(),
      senderID: userId.toString(),
      content: "only message",
      roomID: room._id.toString(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const limit = vi.fn().mockResolvedValue([message]);
    const sort = vi.fn().mockReturnValue({ limit });
    vi.spyOn(Message, "find").mockReturnValue({ sort } as never);

    const response = makeResponse();
    const req = {
      user: { _id: userId, isAdmin: false },
      params: { roomId: room._id.toString() },
      query: { limit: "2" },
    } as unknown as Request;

    await getRoomMessages(req, response);

    expect(response.json).toHaveBeenCalledWith({
      messages: [expect.objectContaining({ id: message._id.toString() })],
      pagination: { hasMore: false, nextCursor: null },
    });
  });

  it("rejects a private-room message from a non-member", async () => {
    const requesterId = new Types.ObjectId();
    const room = makeRoom(new Types.ObjectId());
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    const createMessage = vi.spyOn(Message, "create");
    const response = makeResponse();

    await createRoomMessage(
      makeRequest(requesterId, "hello", room._id.toString()),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(createMessage).not.toHaveBeenCalled();
    expect(broadcastRoomMessage).not.toHaveBeenCalled();
  });

  it("rejects banned words before saving or broadcasting", async () => {
    const userId = new Types.ObjectId();
    const room = makeRoom(userId, ["explicit-language-filter"]);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    const createMessage = vi.spyOn(Message, "create");
    const response = makeResponse();

    await createRoomMessage(
      makeRequest(userId, `${bannedWords[0]}!`, room._id.toString()),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({
      error: "Message was rejected by this room's language rule",
      code: "ROOM_RULE_REJECTED",
    });
    expect(createMessage).not.toHaveBeenCalled();
    expect(broadcastRoomMessage).not.toHaveBeenCalled();
  });

  it("saves an allowed message before broadcasting it", async () => {
    const userId = new Types.ObjectId();
    const room = makeRoom(userId);
    vi.spyOn(Room, "findById").mockResolvedValue(room as never);
    const order: string[] = [];
    const savedMessage = {
      _id: new Types.ObjectId(),
      senderID: userId.toString(),
      content: "hello!",
      roomID: room._id.toString(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(Message, "create").mockImplementation(async () => {
      order.push("save");
      return savedMessage as never;
    });
    broadcastRoomMessage.mockImplementation(() => order.push("broadcast"));
    const response = makeResponse();

    await createRoomMessage(
      makeRequest(userId, " hello! ", room._id.toString()),
      response,
    );

    expect(order).toEqual(["save", "broadcast"]);
    expect(broadcastRoomMessage).toHaveBeenCalledWith(
      room._id.toString(),
      expect.objectContaining({
        content: "hello!",
        senderID: userId.toString(),
      }),
    );
    expect(response.status).toHaveBeenCalledWith(201);
  });
});
