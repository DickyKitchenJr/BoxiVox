import type { IRoom } from "../models/room.js";

export interface RoomActor {
  id: string;
  isAdmin: boolean;
}

function isMember(room: Pick<IRoom, "memberIds">, actor: RoomActor): boolean {
  return room.memberIds.some((memberId) => memberId.toString() === actor.id);
}

export function canReadRoom(
  room: Pick<IRoom, "isPrivate" | "memberIds">,
  actor: RoomActor,
): boolean {
  return !room.isPrivate || actor.isAdmin || isMember(room, actor);
}

export function canPostToRoom(
  room: Pick<IRoom, "isPrivate" | "memberIds">,
  actor: RoomActor,
): boolean {
  return !room.isPrivate || isMember(room, actor);
}

export function canInviteToRoom(
  room: Pick<IRoom, "isPrivate" | "memberIds">,
  actor: RoomActor,
): boolean {
  return room.isPrivate && isMember(room, actor);
}

export function canDeleteRoom(
  room: Pick<IRoom, "createdBy">,
  actor: RoomActor,
): boolean {
  return actor.isAdmin || room.createdBy.toString() === actor.id;
}
