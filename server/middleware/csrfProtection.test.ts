import express from "express";
import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createTrustedOriginProtection,
  csrfProtection,
  generateCsrfToken,
} from "./csrfProtection.js";

const trustedOrigin = "http://localhost:5173";

function createTestApp() {
  const app = express();

  app.use(
    session({
      secret: "test-session-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use(express.json());
  app.use(createTrustedOriginProtection(trustedOrigin));
  app.use(csrfProtection);
  app.get("/csrf-token", (req, res) => {
    res.json({ token: generateCsrfToken(req) });
  });
  app.get("/resource", (_req, res) => {
    res.sendStatus(200);
  });
  app.post("/resource", (_req, res) => {
    res.sendStatus(204);
  });

  return app;
}

describe("CSRF protection", () => {
  it("rejects state-changing requests without a token", async () => {
    await request(createTestApp())
      .post("/resource")
      .set("Origin", trustedOrigin)
      .expect(403, { error: "Invalid or missing CSRF token" });
  });

  it("rejects state-changing requests with an invalid token", async () => {
    const agent = request.agent(createTestApp());

    await agent.get("/csrf-token").expect(200);
    await agent
      .post("/resource")
      .set("Origin", trustedOrigin)
      .set("x-csrf-token", "invalid-token")
      .expect(403, { error: "Invalid or missing CSRF token" });
  });

  it("rejects state-changing requests from an untrusted origin", async () => {
    await request(createTestApp())
      .post("/resource")
      .set("Origin", "https://attacker.example")
      .expect(403, { error: "Untrusted request origin" });
  });

  it("accepts a valid token from the trusted origin", async () => {
    const agent = request.agent(createTestApp());
    const tokenResponse = await agent.get("/csrf-token").expect(200);

    await agent
      .post("/resource")
      .set("Origin", trustedOrigin)
      .set("x-csrf-token", tokenResponse.body.token)
      .expect(204);
  });

  it("does not require a token for read-only requests", async () => {
    await request(createTestApp()).get("/resource").expect(200);
  });
});