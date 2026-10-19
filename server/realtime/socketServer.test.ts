import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import session from "express-session";
import { Types } from "mongoose";
import request from "supertest";
import { io as connectSocket, type Socket } from "socket.io-client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Room } from "../models/room.js";
import { User } from "../models/user.js";
import { initializeSocketServer } from "./socketServer.js";

const trustedOrigin = "http://localhost:5173";
const memberId = new Types.ObjectId();
const outsiderId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const privateRoomId = new Types.ObjectId();
const clients: Socket[] = [];
const users = new Map([
  [memberId.toString(), { _id: memberId, name: "Member", isAdmin: false }],
  [
    outsiderId.toString(),
    { _id: outsiderId, name: "Outsider", isAdmin: false },
  ],
  [adminId.toString(), { _id: adminId, name: "Admin", isAdmin: true }],
]);

let server: ReturnType<typeof createServer>;
let socketServer: ReturnType<typeof initializeSocketServer>;
let baseUrl: string;

async function signIn(userId: Types.ObjectId): Promise<string> {
  const response = await request(server)
    .post(`/test-login/${userId.toString()}`)
    .expect(204);
  const cookie = response.get("Set-Cookie")?.[0];
  if (!cookie) {
    throw new Error("Expected a session cookie");
  }
  return cookie.split(";")[0];
}

async function connect(
  cookie?: string,
  origin = trustedOrigin,
): Promise<Socket> {
  const address = new URL(baseUrl);
  const socket = connectSocket(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    extraHeaders: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: origin,
    },
  });
  clients.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  expect(address.port).not.toBe("");
  return socket;
}

function joinRoom(socket: Socket, roomId: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit("room:join", roomId, resolve);
  });
}

beforeAll(async () => {
  const app = express();
  const sessionMiddleware = session({
    secret: "socket-test-session-secret",
    resave: false,
    saveUninitialized: false,
  });
  app.use(sessionMiddleware);
  app.post("/test-login/:userId", (req, res) => {
    Object.assign(req.session, { userId: req.params.userId });
    res.sendStatus(204);
  });

  server = createServer(app);
  socketServer = initializeSocketServer(
    server,
    trustedOrigin,
    sessionMiddleware,
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise<void>((resolve) => socketServer.close(() => resolve()));
});

describe("Socket.IO authentication and room access", () => {
  it("rejects unauthenticated connections", async () => {
    const socket = connectSocket(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { Origin: trustedOrigin },
    });
    clients.push(socket);

    await expect(
      new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("rejects connections from an untrusted origin", async () => {
    const cookie = await signIn(memberId);
    const socket = connectSocket(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { Cookie: cookie, Origin: "https://untrusted.example" },
      timeout: 2000,
    });
    clients.push(socket);

    await expect(
      new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      }),
    ).rejects.toBeDefined();
  });

  it("allows invited members and admins to join private rooms, but not outsiders", async () => {
    vi.spyOn(User, "findById").mockImplementation(
      (id) => Promise.resolve(users.get(String(id)) ?? null) as never,
    );
    vi.spyOn(Room, "findById").mockResolvedValue({
      _id: privateRoomId,
      isPrivate: true,
      memberIds: [memberId],
    } as never);

    const memberSocket = await connect(await signIn(memberId));
    await expect(
      joinRoom(memberSocket, privateRoomId.toString()),
    ).resolves.toEqual({
      ok: true,
      roomId: privateRoomId.toString(),
    });

    const outsiderSocket = await connect(await signIn(outsiderId));
    await expect(
      joinRoom(outsiderSocket, privateRoomId.toString()),
    ).resolves.toEqual({
      ok: false,
      error: "Room not found",
    });

    const adminSocket = await connect(await signIn(adminId));
    await expect(
      joinRoom(adminSocket, privateRoomId.toString()),
    ).resolves.toEqual({
      ok: true,
      roomId: privateRoomId.toString(),
    });
  });

  it("publishes one global online entry per user across multiple tabs", async () => {
    vi.spyOn(User, "findById").mockImplementation(
      (id) => Promise.resolve(users.get(String(id)) ?? null) as never,
    );
    const cookie = await signIn(memberId);
    const firstSocket = await connect(cookie);
    const presencePromise = new Promise<
      Array<{ userId: string; name: string }>
    >((resolve) => firstSocket.once("presence:update", resolve));
    const secondSocket = await connect(cookie);
    const presence = await presencePromise;

    expect(
      presence.filter((user) => user.userId === memberId.toString()),
    ).toHaveLength(1);
    secondSocket.disconnect();
  });
});
