import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Some webOS TV runtimes fail to load package-local ESM assets that carry the
// `crossorigin` attribute. Strip it from the generated <script>/<link> tags.
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html
          .replace(/\s+crossorigin(=("|')?[^"'>\s]*("|')?)?/g, "")
          .replace(/\s+type=(["'])module\1/g, "");
      },
    },
  };
}

/**
 * Emit a classic <script src> (no type=module) at the end of <body> so
 * packaged webOS can boot and #root exists before React mounts.
 * Avoids @vitejs/plugin-legacy + babel, which OOMs while transpiling hls.js.
 */
function classicScriptEntry(): Plugin {
  return {
    name: "classic-script-entry",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        let out = html.replace(
          /<script([^>]*?)\s+type=(["'])module\2([^>]*)>/g,
          "<script$1$3>",
        );
        // Pull app scripts out of <head> and append before </body> with defer
        // so the DOM (#root) is ready when the IIFE runs.
        const scripts: string[] = [];
        out = out.replace(/<script\b[^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/gi, (tag) => {
          scripts.push(tag.replace(/<script\b/i, "<script defer"));
          return "";
        });
        if (scripts.length && /<\/body>/i.test(out)) {
          out = out.replace(/<\/body>/i, `${scripts.join("\n")}\n</body>`);
        }
        return out;
      },
    },
  };
}

function rewriteAuthCookies(cookies: string[]): string[] {
  return cookies.map((cookie) => {
    let out = cookie;
    out = out.replace(/;\s*Domain=[^;]*/gi, "");
    if (!/;\s*Secure\b/i.test(out)) out += "; Secure";
    if (!/;\s*SameSite=/i.test(out)) out += "; SameSite=Lax";
    return out;
  });
}

// webOS packages load assets from a relative path inside the .ipk, so `base`
// must be relative. Ship a classic (non-module) bundle so older TVs boot.
export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [
    react(),
    ...(command === "serve" ? [basicSsl()] : []),
    classicScriptEntry(),
    stripCrossorigin(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // es2015 covers webOS 4+ Chromium without the babel OOM from plugin-legacy.
    target: "es2015",
    outDir: "dist",
    assetsDir: "assets",
    chunkSizeWarningLimit: 2000,
    cssTarget: "chrome61",
    minify: "esbuild",
    modulePreload: false,
    rollupOptions: {
      output: {
        // Single classic IIFE entry — no type=module, no System.import.
        format: "iife",
        name: "StoryTimeUniverse",
        inlineDynamicImports: true,
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: true,
    port: 5173,
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
}));
