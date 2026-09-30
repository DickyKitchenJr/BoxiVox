import { Router } from "express";
import {
  createUser,
  deleteUser,
  getSpecificUser,
  getUsers,
  updateUser,
} from "../controllers/userControllers.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  passwordConfirmationLimiter,
  registrationLimiter,
} from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const userRouter = Router();

userRouter.post("/", registrationLimiter, asyncHandler(createUser));
userRouter.get("/", asyncHandler(requireAuth), asyncHandler(getUsers));
userRouter.get(
  "/:id",
  asyncHandler(requireAuth),
  asyncHandler(getSpecificUser),
);
userRouter.patch(
  "/:id",
  passwordConfirmationLimiter,
  asyncHandler(requireAuth),
  asyncHandler(updateUser),
);
userRouter.delete(
  "/:id",
  passwordConfirmationLimiter,
  asyncHandler(requireAuth),
  requireAdmin,
  asyncHandler(deleteUser),
);

export default userRouter;
