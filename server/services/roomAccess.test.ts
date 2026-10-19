import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  canDeleteRoom,
  canInviteToRoom,
  canPostToRoom,
  canReadRoom,
} from "./roomAccess.js";

describe("room access policies", () => {
  const memberId = new Types.ObjectId();
  const outsiderId = new Types.ObjectId();
  const creatorId = new Types.ObjectId();
  const privateRoom = {
    isPrivate: true,
    memberIds: [memberId],
    createdBy: creatorId,
  };

  it("allows admins to read private rooms without granting membership actions", () => {
    const admin = { id: outsiderId.toString(), isAdmin: true };

    expect(canReadRoom(privateRoom, admin)).toBe(true);
    expect(canPostToRoom(privateRoom, admin)).toBe(false);
    expect(canInviteToRoom(privateRoom, admin)).toBe(false);
  });

  it("allows private-room members to read, post, and invite", () => {
    const member = { id: memberId.toString(), isAdmin: false };

    expect(canReadRoom(privateRoom, member)).toBe(true);
    expect(canPostToRoom(privateRoom, member)).toBe(true);
    expect(canInviteToRoom(privateRoom, member)).toBe(true);
  });

  it("allows any authenticated user to post to public rooms", () => {
    const publicRoom = { ...privateRoom, isPrivate: false };
    const outsider = { id: outsiderId.toString(), isAdmin: false };

    expect(canReadRoom(publicRoom, outsider)).toBe(true);
    expect(canPostToRoom(publicRoom, outsider)).toBe(true);
    expect(canInviteToRoom(publicRoom, outsider)).toBe(false);
  });

  it("allows only the creator or admin to delete a room", () => {
    expect(
      canDeleteRoom(privateRoom, { id: creatorId.toString(), isAdmin: false }),
    ).toBe(true);
    expect(
      canDeleteRoom(privateRoom, { id: outsiderId.toString(), isAdmin: true }),
    ).toBe(true);
    expect(
      canDeleteRoom(privateRoom, { id: memberId.toString(), isAdmin: false }),
    ).toBe(false);
  });
});
