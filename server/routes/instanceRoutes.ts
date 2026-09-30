import { Router } from "express";
import {
  getInstance,
  updateInstance,
} from "../controllers/instanceController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { passwordConfirmationLimiter } from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const instanceRouter = Router();

instanceRouter.get("/", asyncHandler(getInstance));
instanceRouter.patch(
  "/",
  passwordConfirmationLimiter,
  asyncHandler(requireAuth),
  requireAdmin,
  asyncHandler(updateInstance),
);

export default instanceRouter;
