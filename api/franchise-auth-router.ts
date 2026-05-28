import { z } from "zod";
import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { franchiseUsers, franchises } from "@db/schema";
import { TRPCError } from "@trpc/server";
import * as cookie from "cookie";

const FRANCHISE_COOKIE = "franchise_sid";

// Use JWT_SECRET from env, fallback only for local dev
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "american-outlet-dev-key-change-in-prod"
);

// ─── RATE LIMITING (in-memory, per IP) ──────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

function getClientIP(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function createFranchiseToken(userId: number): Promise<string> {
  return new SignJWT({ userId, type: "franchise" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyFranchiseToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload as { userId: number; type: string };
  } catch {
    return null;
  }
}

export async function getFranchiseUserFromRequest(headers: Headers) {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookie.parse(cookieHeader);
  const token = cookies[FRANCHISE_COOKIE];
  if (!token) return null;

  const payload = await verifyFranchiseToken(token);
  if (!payload || payload.type !== "franchise") return null;

  const db = getDb();
  const users = await db
    .select()
    .from(franchiseUsers)
    .where(eq(franchiseUsers.id, payload.userId))
    .limit(1);

  if (users.length === 0 || !users[0].isActive) return null;

  return users[0];
}

export const franchiseAuthRouter = createRouter({
  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // ─── RATE LIMITING ────────────────────────────────────────
      const clientIP = getClientIP(ctx.req.headers);
      if (!checkRateLimit(clientIP)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Demasiados intentos fallidos. Espere 15 minutos e intente nuevamente.",
        });
      }

      const db = getDb();
      const users = await db
        .select()
        .from(franchiseUsers)
        .where(eq(franchiseUsers.username, input.username))
        .limit(1);

      if (users.length === 0) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contrasena incorrectos" });
      }

      const user = users[0];
      if (user.passwordHash !== hashPassword(input.password)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contrasena incorrectos" });
      }

      if (!user.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario inactivo" });
      }

      const token = await createFranchiseToken(user.id);

      const cookieOptions = {
        httpOnly: true,
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60,
      };

      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(FRANCHISE_COOKIE, token, cookieOptions)
      );

      const franchiseData = await db
        .select()
        .from(franchises)
        .where(eq(franchises.id, user.franchiseId))
        .limit(1);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          franchiseId: user.franchiseId,
          franchise: franchiseData[0] || null,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const user = await getFranchiseUserFromRequest(ctx.req.headers);
    if (!user) return null;

    const db = getDb();
    const franchiseData = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, user.franchiseId))
      .limit(1);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      franchiseId: user.franchiseId,
      franchise: franchiseData[0] || null,
    };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const cookieOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    };

    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(FRANCHISE_COOKIE, "", cookieOptions)
    );

    return { success: true };
  }),
});
