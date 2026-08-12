import express from "express";

import { CORS_ORIGIN, PORT } from "./config";
import { filesRouter } from "./routes/files";
import { roomsRouter } from "./routes/rooms";
import { shareLinksRouter } from "./routes/shareLinks";

const app = express();

app.disable("x-powered-by");

if (CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, if-match, if-none-match");
    res.setHeader("Access-Control-Expose-Headers", "etag");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", shareLinksRouter);
app.use("/api", roomsRouter);
app.use("/api", filesRouter);

// exportToBackend never checks response.ok; it reads json.id and then branches
// on json.error_class. An oversize upload therefore has to answer with a JSON
// body carrying that key, or the client reports a generic failure instead of
// "your scene is too big".
app.use(
  (
    error: express.Errback & { type?: string; status?: number },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error && (error as any).type === "entity.too.large") {
      res.status(413).json({
        error_class: "RequestTooLargeError",
        message: "Payload is longer than the configured limit in bytes",
      });
      return;
    }

    console.error(error);
    res.status(500).json({ error_class: "InternalError" });
  },
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`excalidraw-server listening on 0.0.0.0:${PORT}`);
});
