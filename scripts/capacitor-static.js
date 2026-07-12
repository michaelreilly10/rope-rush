import fs from "fs";
import path from "path";

const SSR_SERVER_PATH = path.resolve("node_modules/.nitro/vite/services/ssr/index.js");
const DIST_DIR = path.resolve("dist");
const CLIENT_DIR = path.resolve("dist/client");
const OUTPUT_DIR = path.resolve("dist/capacitor");

async function main() {
  if (!fs.existsSync(SSR_SERVER_PATH)) {
    throw new Error(`SSR server not found at ${SSR_SERVER_PATH}. Run the build first.`);
  }

  const server = await import(SSR_SERVER_PATH);
  const handler = server.default ?? server;
  const response = await handler.fetch(new Request("http://localhost/"));
  if (!response.ok) {
    throw new Error(`Failed to render shell: ${response.status} ${response.statusText}`);
  }

  let html = await response.text();

  // Make asset paths relative so they work inside the Capacitor WebView.
  // Vite emits absolute paths like /assets/...; the Capacitor shell is served
  // from a file:// or capacitor:// origin, so we need relative paths.
  // Replace every absolute /assets/ reference (HTML attributes, JS strings, etc.).
  html = html.replace(/(=\s*["']?)\/assets\//g, "$1assets/");

  // Remove any base path that assumes the site is served from /.
  html = html.replace(/(=\s*["']?)\//g, "$1./");

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), html);

  // Copy the client assets into the Capacitor web dir.
  if (fs.existsSync(CLIENT_DIR)) {
    copyDir(CLIENT_DIR, OUTPUT_DIR);
  }

  console.log(`Capacitor static shell written to ${OUTPUT_DIR}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
