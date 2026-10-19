import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createMessageCreationAllowance,
  createFailedMessageLimiter,
  createLoginLimiter,
  createRoomCreationLimiter,
} from "./rateLimiters.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.post("/login", createLoginLimiter(2), (req, res) => {
    if (req.body?.valid) {
      return res.status(200).json({ ok: true });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  });

  return app;
}

describe("login rate limiter", () => {
  it("blocks failed requests after the configured limit", async () => {
    const app = createTestApp();

    await request(app).post("/login").send({ valid: false }).expect(401);
    await request(app).post("/login").send({ valid: false }).expect(401);
    await request(app).post("/login").send({ valid: false }).expect(429, {
      error: "Too many failed login attempts. Try again in 15 minutes.",
    });
  });

  it("does not count successful requests against the failure limit", async () => {
    const app = createTestApp();

    await request(app).post("/login").send({ valid: true }).expect(200);
    await request(app).post("/login").send({ valid: false }).expect(401);
    await request(app).post("/login").send({ valid: false }).expect(401);
    await request(app).post("/login").send({ valid: false }).expect(429);
  });
});

describe("room creation rate limiter", () => {
  it("limits each authenticated user independently", async () => {
    const app = express();
    app.use((req, _res, next) => {
      const userId = req.header("x-user-id") ?? "missing-user";
      req.user = { _id: { toString: () => userId } } as never;
      next();
    });
    app.post("/rooms", createRoomCreationLimiter(2), (_req, res) => {
      res.sendStatus(201);
    });

    await request(app).post("/rooms").set("x-user-id", "user-a").expect(201);
    await request(app).post("/rooms").set("x-user-id", "user-a").expect(201);
    await request(app).post("/rooms").set("x-user-id", "user-a").expect(429);
    await request(app).post("/rooms").set("x-user-id", "user-b").expect(201);
  });
});

describe("message rate limiters", () => {
  function createMessageApp() {
    const app = express();
    const reserveMessageCreation = createMessageCreationAllowance(2);
    app.use((req, _res, next) => {
      req.user = { _id: { toString: () => "user-a" } } as never;
      next();
    });
    app.post(
      "/messages",
      createFailedMessageLimiter(2),
      (req, res, next) => {
        if (req.header("x-rule-rejected")) return next();

        const reservation = reserveMessageCreation(req.user!._id.toString());
        if (!reservation.allowed) {
          res.setHeader("Retry-After", reservation.retryAfterSeconds);
          return res.sendStatus(429);
        }

        res.on("finish", () => {
          if (res.statusCode >= 400) reservation.release();
        });
        next();
      },
      (req, res) => res.sendStatus(req.header("x-rule-rejected") ? 422 : 201),
    );
    return app;
  }

  it("limits successful message sends separately from rejected sends", async () => {
    const app = createMessageApp();

    await request(app).post("/messages").expect(201);
    await request(app).post("/messages").expect(201);
    await request(app)
      .post("/messages")
      .set("x-rule-rejected", "true")
      .expect(422);
    await request(app).post("/messages").expect(429);
  });

  it("limits repeated room-rule rejections separately", async () => {
    const app = createMessageApp();

    await request(app)
      .post("/messages")
      .set("x-rule-rejected", "true")
      .expect(422);
    await request(app)
      .post("/messages")
      .set("x-rule-rejected", "true")
      .expect(422);
    await request(app)
      .post("/messages")
      .set("x-rule-rejected", "true")
      .expect(429);
  });
});
