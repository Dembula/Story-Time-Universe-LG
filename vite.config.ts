import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Some webOS TV runtimes fail to load package-local ESM assets that carry the
// `crossorigin` attribute. Strip it from the generated <script>/<link> tags.
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    // Run after @vitejs/plugin-legacy injects its <script> tags.
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(/\s+crossorigin(=("|')?[^"'>\s]*("|')?)?/g, "");
      },
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
// must be relative. Older Chromium on webOS 3–6 cannot run native ESM from a
// packaged app — ship a classic (SystemJS/IIFE) legacy bundle only.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    basicSsl(),
    legacy({
      // LG web engine matrix: 3.x=Chrome38, 4.x=53, 5.x=68, 6.x=79, 22+=87+.
      targets: ["chrome >= 38"],
      // Packaged webOS apps commonly reject type=module local scripts
      // (TVAPPQA-61911 black screen). Emit only the classic legacy entry.
      renderModernChunks: false,
      polyfills: true,
      additionalLegacyPolyfills: [
        "regenerator-runtime/runtime",
        "whatwg-fetch",
      ],
    }),
    stripCrossorigin(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Downlevel target; @vitejs/plugin-legacy further transpile for Chrome 38+.
    target: "es2015",
    outDir: "dist",
    assetsDir: "assets",
    chunkSizeWarningLimit: 2000,
    cssTarget: "chrome61",
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
    // NextAuth cookies on https://localhost:5173 (desktop preview only).
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
