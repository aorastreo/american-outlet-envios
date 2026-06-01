import { authRouter } from "./auth-router";
import { franchiseAuthRouter } from "./franchise-auth-router";
import { franchiseRouter } from "./franchise-router";
import { shipmentRouter } from "./shipment-router";
import { routeRouter } from "./route-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  franchiseAuth: franchiseAuthRouter,
  franchise: franchiseRouter,
  shipment: shipmentRouter,
  route: routeRouter,
});

export type AppRouter = typeof appRouter;
