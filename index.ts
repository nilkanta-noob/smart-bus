import path from "node:path";
import express from "express";
import { registerApplicationRoutes } from "./server/_core/app";

// Vercel detects this root entry and deploys the exported Express app as one
// Function. Static files under public/ are served by Vercel's CDN.
const app = registerApplicationRoutes(express());

// Support client-side routes when a URL is opened directly. API misses remain
// JSON 404s so they can never be mistaken for the frontend document.
app.get("*", (req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendFile(path.resolve(process.cwd(), "public", "index.html"), error => {
    if (error) next(error);
  });
});

export default app;
