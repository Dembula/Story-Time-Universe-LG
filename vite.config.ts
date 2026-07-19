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
  },
});
