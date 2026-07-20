import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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

// webOS packages load assets from a relative path inside the .ipk, so `base`
// must be relative. We also down-level the JS output so it runs on the older
// Chromium builds shipped on webOS 4.x / 5.x TVs.
export default defineConfig({
  base: "./",
  plugins: [react(), stripCrossorigin()],
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
    // Same-origin proxy so browser requests from localhost:5173 avoid CORS
    // and can receive NextAuth session cookies during local development.
    proxy: {
      "/api": {
        target: "https://story-time.online",
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: "localhost",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (!cookies) return;
            // Drop Secure so cookies stick on http://localhost, and relax
            // SameSite=None (which requires Secure) to Lax for local auth.
            proxyRes.headers["set-cookie"] = cookies.map((c) =>
              c
                .replace(/;\s*Secure/gi, "")
                .replace(/;\s*SameSite=None/gi, "; SameSite=Lax"),
            );
          });
        },
      },
    },
  },
});
