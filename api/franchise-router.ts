import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { franchises } from "@db/schema";
import { isDriverAccountFranchise, isRetiredFranchise } from "../src/lib/franchise-groups";

export const franchiseRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(franchises).orderBy(franchises.id);
    return rows.filter((franchise) => !isRetiredFranchise(franchise) && !isDriverAccountFranchise(franchise));
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(franchises)
        .where(eq(franchises.id, input.id))
        .limit(1);
      return result[0] || null;
    }),
});
