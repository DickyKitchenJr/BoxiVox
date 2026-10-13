import { Router } from "express";
import {
  createRoom,
  deleteRoom,
  getRoom,
  getRooms,
  inviteRoomMember,
} from "../controllers/roomController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const roomRouter = Router();

roomRouter.get("/", asyncHandler(requireAuth), asyncHandler(getRooms));
roomRouter.post("/", asyncHandler(requireAuth), asyncHandler(createRoom));
roomRouter.get("/:roomId", asyncHandler(requireAuth), asyncHandler(getRoom));
roomRouter.post(
  "/:roomId/members",
  asyncHandler(requireAuth),
  asyncHandler(inviteRoomMember),
);
roomRouter.delete(
  "/:roomId",
  asyncHandler(requireAuth),
  asyncHandler(deleteRoom),
);

export default roomRouter;
