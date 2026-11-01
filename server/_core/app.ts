import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerRoutesProxy } from "./routesProxy";
import { registerGeocodeProxy } from "./geocodeProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

/** Register application middleware and routes without starting a listener. */
export function registerApplicationRoutes(app: Express) {
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  registerStorageProxy(app);
  registerRoutesProxy(app);
  registerGeocodeProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}

/** Build the API app for the standalone development server. */
export function createApiApp() {
  return registerApplicationRoutes(express());
}
