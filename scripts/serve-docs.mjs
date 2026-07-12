import { createReadStream, existsSync, statSync } from "fs";
import { createServer } from "http";
import { extname, join, normalize, resolve } from "path";

const port = Number(process.env.PORT || 3000);
const docsRoot = resolve("docs");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

function filePathForUrl(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const fullPath = resolve(docsRoot, normalize(relativePath));

  if (!fullPath.startsWith(docsRoot)) {
    return null;
  }

  return fullPath;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const filePath = filePathForUrl(url.pathname);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Clinic manager docs app is running at http://localhost:${port}`);
  console.log(`Serving ${join(docsRoot, "index.html")}`);
});
