import { z } from "zod";
import { eq, not, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { franchises } from "@db/schema";

export const franchiseRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    // OCULTO: grecia, palmares, san_ramon, bodega_sabana - habilitar cuando se vuelvan a usar rutas de camion
    const hiddenCodes = ["grecia", "palmares", "san_ramon", "bodega_sabana"];
    return db.select().from(franchises).where(not(inArray(franchises.code, hiddenCodes))).orderBy(franchises.id);
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
