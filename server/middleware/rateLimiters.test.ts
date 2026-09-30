import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLoginLimiter } from "./rateLimiters.js";

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
