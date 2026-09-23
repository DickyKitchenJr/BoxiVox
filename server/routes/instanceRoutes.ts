import { Router } from "express";
import {
  getInstance,
  updateInstance,
} from "../controllers/instanceController.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const instanceRouter = Router();

instanceRouter.get("/", asyncHandler(getInstance));
instanceRouter.patch("/", asyncHandler(updateInstance));

export default instanceRouter;
