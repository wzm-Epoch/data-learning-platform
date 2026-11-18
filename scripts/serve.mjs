import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
try {
  await stat(path.join(root, "index.html"));
} catch {
  console.error("未找到生产构建，请先执行 npm run build。");
  process.exit(1);
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1:4173").pathname,
    );
    const file = path.resolve(
      root,
      "." + (name === "/" ? "/index.html" : name),
    );
    if (
      !file.startsWith(root + path.sep) &&
      file !== path.join(root, "index.html")
    ) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("资源不存在，请检查构建文件。");
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "端口4173已被占用。请关闭占用进程后重试；为保持学习记录来源一致，不会自动换端口。"
      : error.message,
  );
  process.exit(1);
});
server.listen(4173, "127.0.0.1", () =>
  console.log("生产构建已启动：http://127.0.0.1:4173 （Ctrl+C停止）"),
);
