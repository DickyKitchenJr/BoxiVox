import { Router } from "express";
import {
  createRoom,
  deleteRoom,
  getRoom,
  getRooms,
  inviteRoomMember,
} from "../controllers/roomController.js";
import {
  createRoomMessage,
  getRoomMessages,
} from "../controllers/messageController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createFailedMessageLimiter,
  roomCreationLimiter,
} from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const roomRouter = Router();

roomRouter.get("/", asyncHandler(requireAuth), asyncHandler(getRooms));
roomRouter.post(
  "/",
  asyncHandler(requireAuth),
  roomCreationLimiter,
  asyncHandler(createRoom),
);
roomRouter.get("/:roomId", asyncHandler(requireAuth), asyncHandler(getRoom));
roomRouter.post(
  "/:roomId/members",
  asyncHandler(requireAuth),
  asyncHandler(inviteRoomMember),
);
roomRouter.get(
  "/:roomId/messages",
  asyncHandler(requireAuth),
  asyncHandler(getRoomMessages),
);
roomRouter.post(
  "/:roomId/messages",
  asyncHandler(requireAuth),
  createFailedMessageLimiter(),
  asyncHandler(createRoomMessage),
);
roomRouter.delete(
  "/:roomId",
  asyncHandler(requireAuth),
  asyncHandler(deleteRoom),
);

export default roomRouter;
