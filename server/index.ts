import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { asyncHandler } from "./utilities/asyncHandler";
import { errorHandler } from "./utilities/errorHandler";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use(errorHandler);

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI in environment");

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`API server running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
