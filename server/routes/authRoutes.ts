import { Router } from "express";
import {
  changePassword,
  claimPassword,
  getCurrentUser,
  login,
  logout,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  claimPasswordLimiter,
  loginLimiter,
  passwordConfirmationLimiter,
} from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const authRouter = Router();

authRouter.post("/login", loginLimiter, asyncHandler(login));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", asyncHandler(getCurrentUser));
authRouter.post(
  "/claim-password",
  claimPasswordLimiter,
  asyncHandler(claimPassword),
);
authRouter.post(
  "/change-password",
  passwordConfirmationLimiter,
  asyncHandler(requireAuth),
  asyncHandler(changePassword),
);

export default authRouter;
