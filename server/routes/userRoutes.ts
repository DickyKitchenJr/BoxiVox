import { Router } from "express";
import {
  createUser,
  deleteUser,
  getSpecificUser,
  getUsers,
  updateUser,
} from "../controllers/userControllers.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const userRouter = Router();

userRouter.post("/", asyncHandler(createUser));
userRouter.get("/", asyncHandler(getUsers));
userRouter.get("/:id", asyncHandler(getSpecificUser));
userRouter.patch("/:id", asyncHandler(updateUser));
userRouter.delete("/:id", asyncHandler(deleteUser));

export default userRouter;