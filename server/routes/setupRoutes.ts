import { Router } from "express";
import { completeSetup } from "../controllers/setupController.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

const setupRouter = Router();

setupRouter.post("/", asyncHandler(completeSetup));

export default setupRouter;
