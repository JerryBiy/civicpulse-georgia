import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 10000);
const distRoot = join(process.cwd(), "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requestedPath = normalize(join(distRoot, pathname));
  const safePath = requestedPath.startsWith(distRoot) ? requestedPath : distRoot;
  const assetPath = existsSync(safePath) && statSync(safePath).isFile()
    ? safePath
    : join(distRoot, "index.html");

  response.setHeader("Content-Type", mimeTypes[extname(assetPath)] || "application/octet-stream");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  createReadStream(assetPath).pipe(response);
}).listen(port, () => {
  console.log(`CivicPulse Georgia is running on port ${port}`);
});
