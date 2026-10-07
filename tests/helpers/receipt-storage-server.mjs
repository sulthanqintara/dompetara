// Local Supabase Storage protocol double. Never use with production credentials.
import { createServer } from "node:http";
const objects = new Map();
let failUpload = false,
  failDelete = false,
  uploadDelay = 0;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (path === "/test-state")
    return response.end(JSON.stringify({ ids: [...objects.keys()] }));
  if (path === "/test-control") {
    const control = JSON.parse(body.toString());
    failUpload = control.failUpload ?? failUpload;
    failDelete = control.failDelete ?? failDelete;
    uploadDelay = control.uploadDelay ?? uploadDelay;
    return response.end("ok");
  }
  if (
    request.headers.authorization !== "Bearer receipt-storage-test-key" ||
    request.headers.apikey !== "receipt-storage-test-key"
  ) {
    response.writeHead(401);
    return response.end();
  }
  if (
    request.method === "DELETE" &&
    path === "/storage/v1/object/receipt-images"
  ) {
    if (failDelete) {
      response.writeHead(503);
      return response.end();
    }
    for (const prefix of JSON.parse(body.toString()).prefixes)
      objects.delete(prefix.replace(/\.jpg$/, ""));
    return response.end("[]");
  }
  const match = path.match(
    /^\/storage\/v1\/object\/(authenticated\/)?receipt-images\/([a-f0-9-]+)\.jpg$/,
  );
  if (!match) {
    response.writeHead(404);
    return response.end();
  }
  const id = match[2];
  if (request.method === "POST" && !match[1]) {
    if (request.headers["content-type"] !== "image/jpeg") {
      response.writeHead(400);
      return response.end();
    }
    objects.set(id, body);
    if (uploadDelay)
      await new Promise((resolve) => setTimeout(resolve, uploadDelay));
    if (failUpload) {
      response.writeHead(503);
      return response.end();
    }
    return response.end("{}");
  }
  if (request.method === "GET" && match[1] && objects.has(id)) {
    response.writeHead(200, { "Content-Type": "image/jpeg" });
    return response.end(objects.get(id));
  }
  response.writeHead(404);
  response.end();
});
server.listen(54330, "127.0.0.1", () =>
  console.log("Local receipt storage double ready on port 54330."),
);
