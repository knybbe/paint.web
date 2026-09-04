import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const assetsDir = path.join(distDir, "assets");

if (fs.existsSync(distDir)) {
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, path.join(distDir, "404.html"));
  }

  if (fs.existsSync(assetsDir)) {
    const recoveryCode = `// Self-healing recovery for clients intercepted by a stale parent service worker
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (e) {
    console.error('Failed to clean stale service worker:', e);
  } finally {
    window.location.reload();
  }
})();
`;
    fs.writeFileSync(path.join(assetsDir, "index-Bgb6aQ1m.js"), recoveryCode, "utf8");
    fs.writeFileSync(path.join(assetsDir, "index-XHZKpuuo.css"), "/* recovery css stub */\n", "utf8");
  }
}
