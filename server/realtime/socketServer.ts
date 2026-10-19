import type { RequestHandler } from "express";
import type { Session, SessionData } from "express-session";
import type { Server as HttpServer } from "node:http";
import { Types } from "mongoose";
import { Server } from "socket.io";
import { User } from "../models/user.js";
import { Room } from "../models/room.js";
import { canReadRoom } from "../services/roomAccess.js";

interface SocketUser {
  id: string;
  name: string;
  isAdmin: boolean;
}

interface SocketData {
  user?: SocketUser;
  sessionId?: string;
}

interface RoomJoinResponse {
  ok: boolean;
  error?: string;
  roomId?: string;
}

type RoomJoinAcknowledgement = (response: RoomJoinResponse) => void;

let ioServer: Server | undefined;
const onlineUsers = new Map<string, { name: string; socketIds: Set<string> }>();

function userSocketRoom(userId: string): string {
  return `user:${userId}`;
}

function sessionSocketRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

function chatSocketRoom(roomId: string): string {
  return `chat:${roomId}`;
}

function presenceSnapshot() {
  return [...onlineUsers.entries()]
    .map(([userId, user]) => ({ userId, name: user.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function publishPresence() {
  ioServer?.emit("presence:update", presenceSnapshot());
}

export function initializeSocketServer(
  httpServer: HttpServer,
  clientOrigin: string,
  sessionMiddleware: RequestHandler,
): Server {
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
    allowRequest: (request, callback) => {
      callback(null, request.headers.origin === clientOrigin);
    },
  });

  ioServer = io;
  io.engine.use(sessionMiddleware);

  io.use(async (socket, next) => {
    try {
      const requestWithSession = socket.request as typeof socket.request & {
        session?: Session & SessionData;
        sessionID?: string;
      };
      const userId = requestWithSession.session?.userId;
      const sessionId = requestWithSession.sessionID;
      if (!userId || !sessionId) {
        return next(new Error("Authentication required"));
      }

      const user = await User.findById(userId);
      if (!user) return next(new Error("Authentication required"));

      Object.assign(socket.data as SocketData, {
        user: {
          id: user._id.toString(),
          name: user.name,
          isAdmin: user.isAdmin,
        },
        sessionId,
      });
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const user = (socket.data as SocketData).user!;
    const currentPresence = onlineUsers.get(user.id) ?? {
      name: user.name,
      socketIds: new Set<string>(),
    };
    currentPresence.socketIds.add(socket.id);
    onlineUsers.set(user.id, currentPresence);

    await socket.join(userSocketRoom(user.id));
    await socket.join(
      sessionSocketRoom((socket.data as SocketData).sessionId!),
    );
    publishPresence();
    socket.on(
      "room:join",
      async (roomId: unknown, acknowledge?: RoomJoinAcknowledgement) => {
        if (typeof roomId !== "string" || !Types.ObjectId.isValid(roomId)) {
          acknowledge?.({ ok: false, error: "Invalid room ID" });
          return;
        }

        try {
          const room = await Room.findById(roomId);
          if (
            !room ||
            !canReadRoom(room, { id: user.id, isAdmin: user.isAdmin })
          ) {
            acknowledge?.({ ok: false, error: "Room not found" });
            return;
          }

          await socket.join(chatSocketRoom(roomId));
          acknowledge?.({ ok: true, roomId });
        } catch {
          acknowledge?.({ ok: false, error: "Unable to join room" });
        }
      },
    );

    socket.on("room:leave", async (roomId: unknown) => {
      if (typeof roomId === "string" && Types.ObjectId.isValid(roomId)) {
        await socket.leave(chatSocketRoom(roomId));
      }
    });

    socket.on("disconnect", () => {
      const presence = onlineUsers.get(user.id);
      presence?.socketIds.delete(socket.id);
      if (presence?.socketIds.size === 0) onlineUsers.delete(user.id);

      publishPresence();
    });
  });

  return io;
}

export function broadcastRoomMessage(roomId: string, message: unknown): void {
  ioServer?.to(chatSocketRoom(roomId)).emit("message:new", message);
}

export function notifyRoomDeleted(roomId: string): void {
  const socketRoom = chatSocketRoom(roomId);
  ioServer?.to(socketRoom).emit("room:deleted", { roomId });
  ioServer?.in(socketRoom).socketsLeave(socketRoom);
}

export function disconnectUserSockets(userId: string): void {
  ioServer?.in(userSocketRoom(userId)).disconnectSockets(true);
}

export function disconnectSessionSockets(sessionId: string): void {
  ioServer?.in(sessionSocketRoom(sessionId)).disconnectSockets(true);
}
