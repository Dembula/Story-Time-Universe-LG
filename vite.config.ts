import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Some webOS TV runtimes fail to load package-local ESM assets that carry the
// `crossorigin` attribute. Strip it from the generated <script>/<link> tags.
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(=("|')?[^"'>\s]*("|')?)?/g, "");
    },
  };
}

/**
 * NextAuth sends `__Host-` / `__Secure-` session cookies. Browsers only store
 * those on HTTPS, and `__Host-` cookies must not carry a Domain attribute.
 * Rewrite proxied Set-Cookie headers so they work on https://localhost.
 */
function rewriteAuthCookies(cookies: string[]): string[] {
  return cookies.map((cookie) => {
    let out = cookie;
    // Drop Domain so the cookie is host-only for localhost (__Host- requires this).
    out = out.replace(/;\s*Domain=[^;]*/gi, "");
    // Keep Secure (required by __Host- / __Secure-); add it if the backend omitted it.
    if (!/;\s*Secure\b/i.test(out)) out += "; Secure";
    // SameSite=None is fine over HTTPS; leave as-is. If missing, prefer Lax.
    if (!/;\s*SameSite=/i.test(out)) out += "; SameSite=Lax";
    return out;
  });
}

// webOS packages load assets from a relative path inside the .ipk, so `base`
// must be relative. We also down-level the JS output so it runs on the older
// Chromium builds shipped on webOS 4.x / 5.x TVs.
export default defineConfig({
  base: "./",
  plugins: [react(), basicSsl(), stripCrossorigin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2018",
    outDir: "dist",
    assetsDir: "assets",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          hls: ["hls.js"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // HTTPS via @vitejs/plugin-basic-ssl so browsers accept __Host- / __Secure-
    // NextAuth cookies on https://localhost:5173.
    // Same-origin proxy avoids CORS and forwards session cookies in local dev.
    proxy: {
      "/api": {
        target: "https://story-time.online",
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (!cookies) return;
            proxyRes.headers["set-cookie"] = rewriteAuthCookies(cookies);
          });
        },
      },
    },
  },
});
