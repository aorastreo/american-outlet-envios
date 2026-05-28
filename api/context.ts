import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { getFranchiseUserFromRequest } from "./franchise-auth-router";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  franchiseUser?: {
    id: number;
    username: string;
    displayName: string;
    role: string;
    franchiseId: number;
  };
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try OAuth auth
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // OAuth auth is optional
  }

  // Try franchise auth
  try {
    const franchiseUser = await getFranchiseUserFromRequest(opts.req.headers);
    if (franchiseUser) {
      ctx.franchiseUser = {
        id: franchiseUser.id,
        username: franchiseUser.username,
        displayName: franchiseUser.displayName,
        role: franchiseUser.role,
        franchiseId: franchiseUser.franchiseId,
      };
    }
  } catch {
    // Franchise auth is optional
  }

  return ctx;
}
