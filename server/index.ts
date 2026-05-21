import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { generateSculpture, catalogSize } from "./generator";
import { CATALOG } from "./catalog";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, catalog: catalogSize() });
});

app.get("/api/catalog", (_req: Request, res: Response) => {
  res.json(CATALOG);
});

app.get("/api/generate", (_req: Request, res: Response) => {
  const sculpture = generateSculpture();
  res.json(sculpture);
});

// Serve built client in production.
if (process.env.NODE_ENV === "production") {
  // dist/server/index.js -> ../public
  const clientDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  } else {
    console.warn(
      `[warn] production mode but no client bundle at ${clientDir}`,
    );
  }
}

app.listen(PORT, () => {
  console.log(`hardware-sculpture server listening on :${PORT}`);
});
