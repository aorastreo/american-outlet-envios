import { z } from "zod";
import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { and, asc, eq, ne } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { franchiseUsers, franchises } from "@db/schema";
import { isRetiredFranchise, getFranchiseGroup } from "../src/lib/franchise-groups";
import { TRPCError } from "@trpc/server";
import * as cookie from "cookie";
import {
  assertPasswordManagerUser,
  checkLoginRateLimit,
  getClientIP,
  jwtSecretBytes,
} from "./lib/auth-guards";

const FRANCHISE_COOKIE = "franchise_sid";
const JWT_SECRET = jwtSecretBytes();

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

function canChangeFranchisePassword(franchise: { code?: string | null; name?: string | null; displayName?: string | null }) {
  if (isRetiredFranchise(franchise)) return false;
  const code = (franchise.code || "").toLowerCase();
  if (code === "rutas") return false; // chofer is listed separately as username "chofer"
  const text = `${franchise.code || ""} ${franchise.name || ""} ${franchise.displayName || ""}`.toLowerCase();
  return getFranchiseGroup(text) !== "route";
}

function cleanFranchiseLabel(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
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
      if (!checkLoginRateLimit(clientIP)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Demasiados intentos fallidos. Espere 15 minutos e intente nuevamente.",
        });
      }

      const db = getDb();
      if (input.username.trim().toLowerCase().includes("ganga")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contrasena incorrectos" });
      }
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

  passwordFranchises: franchiseAuthedQuery.query(async ({ ctx }) => {
    assertPasswordManagerUser(ctx.franchiseUser!.username);
    const db = getDb();
    const rows = await db.select().from(franchises).orderBy(asc(franchises.displayName));
    const list = rows
      .filter((franchise) => canChangeFranchisePassword(franchise))
      .map((franchise) => ({
        id: franchise.id,
        name: cleanFranchiseLabel(franchise.displayName),
        username: franchise.code,
      }));

    const chofer = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, "chofer")).limit(1);
    if (chofer[0]) {
      list.push({
        id: chofer[0].franchiseId,
        name: "Chofer - Rutas",
        username: "chofer",
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }),

  setFranchisePassword: franchiseAuthedQuery
    .input(z.object({
      franchiseId: z.number().int().positive(),
      password: z.string().min(4).max(80),
      username: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPasswordManagerUser(ctx.franchiseUser!.username);
      const db = getDb();
      const franchiseRows = await db.select().from(franchises).where(eq(franchises.id, input.franchiseId)).limit(1);
      const franchise = franchiseRows[0];
      if (!franchise) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Franquicia no encontrada" });
      }

      const wantedUsername = (input.username || franchise.code || "").trim().toLowerCase();
      const isChoferTarget = wantedUsername === "chofer" || franchise.code === "rutas";
      if (!isChoferTarget && !canChangeFranchisePassword(franchise)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Franquicia no encontrada" });
      }

      const accounts = await db.select().from(franchiseUsers)
        .where(eq(franchiseUsers.franchiseId, franchise.id))
        .orderBy(asc(franchiseUsers.id));
      const main = isChoferTarget
        ? accounts.find((account) => account.username === "chofer")
        : accounts.find((account) => account.username === franchise.code) || accounts[0];
      if (!main) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Esa franquicia no tiene usuario" });
      }

      await db.update(franchiseUsers).set({
        passwordHash: hashPassword(input.password),
        isActive: 1,
      }).where(eq(franchiseUsers.id, main.id));

      const extras = accounts.filter((account) => account.id !== main.id && account.username !== "chofer");
      if (extras.length > 0) {
        await db.update(franchiseUsers).set({ isActive: 0 }).where(and(
          eq(franchiseUsers.franchiseId, franchise.id),
          ne(franchiseUsers.id, main.id),
          ne(franchiseUsers.username, "chofer"),
        ));
      }

      return { success: true, username: main.username };
    }),
});
