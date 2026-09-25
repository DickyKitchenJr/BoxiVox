import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import { asyncHandler } from "./utilities/asyncHandler";
import { errorHandler } from "./utilities/errorHandler";
import userRouter from "./routes/userRoutes.js";
import setupRouter from "./routes/setupRoutes.js";
import instanceRouter from "./routes/instanceRoutes.js";
import dotenv from "dotenv";

dotenv.config();

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in environment`);

  return value;
}

const clientOrigin = getRequiredEnvironmentVariable("CLIENT_ORIGIN");
const mongoUri = getRequiredEnvironmentVariable("MONGODB_URI");
const sessionSecret = getRequiredEnvironmentVariable("SESSION_SECRET");

const sessionStoreTtlSeconds = 24 * 60 * 60;

const app = express();

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);

app.use(
  session({
    name: "boxivox.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessions",
      ttl: sessionStoreTtlSeconds,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/setup", setupRouter);
app.use("/api/instance", instanceRouter);
app.use("/api/users", userRouter);

app.use(errorHandler);

async function start() {
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
