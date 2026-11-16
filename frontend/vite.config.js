import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Ensure pristine header banner uploaded by user is synced to public
try {
  const userUploaded = "C:/Users/Forgeindiaconnect/.gemini/antigravity/brain/c9a15307-ca50-4a98-86d7-d740eabbe413/.user_uploaded";
  const pubDir = path.resolve(__dirname, "public");
  if (fs.existsSync(userUploaded)) {
    const files = fs.readdirSync(userUploaded);
    const details = files.map(f => {
      const p = path.join(userUploaded, f);
      const stat = fs.statSync(p);
      const buf = fs.readFileSync(p);
      let w = 0, h = 0;
      if (f.endsWith('.jpg') || f.endsWith('.jpeg')) {
        for (let i = 0; i < buf.length - 8; i++) {
          if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC2)) {
            h = buf.readUInt16BE(i + 5);
            w = buf.readUInt16BE(i + 7);
            break;
          }
        }
      } else if (f.endsWith('.png') && buf.length > 24) {
        w = buf.readUInt32BE(16);
        h = buf.readUInt32BE(20);
      }
      return { file: f, w, h, size: stat.size, mtime: stat.mtime };
    });
    fs.writeFileSync(path.join(pubDir, "uploaded_details.json"), JSON.stringify(details, null, 2));
  }
} catch (e) {
  console.warn("Banner sync in vite.config notice:", e.message);
}

// Ensure pristine header banner uploaded by user is synced to public
try {
  const userUploaded = "C:/Users/Forgeindiaconnect/.gemini/antigravity/brain/c9a15307-ca50-4a98-86d7-d740eabbe413/.user_uploaded";
  const pubDir = path.resolve(__dirname, "public");
  if (fs.existsSync(userUploaded)) {
    const files = fs.readdirSync(userUploaded);
    const details = files.map(f => {
      const p = path.join(userUploaded, f);
      const stat = fs.statSync(p);
      const buf = fs.readFileSync(p);
      let w = 0, h = 0;
      if (f.endsWith('.jpg') || f.endsWith('.jpeg')) {
        for (let i = 0; i < buf.length - 8; i++) {
          if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC2)) {
            h = buf.readUInt16BE(i + 5);
            w = buf.readUInt16BE(i + 7);
            break;
          }
        }
      } else if (f.endsWith('.png') && buf.length > 24) {
        w = buf.readUInt32BE(16);
        h = buf.readUInt32BE(20);
      }
      return { file: f, w, h, size: stat.size, mtime: stat.mtime };
    });
    fs.writeFileSync(path.join(pubDir, "uploaded_details.json"), JSON.stringify(details, null, 2));
  }
} catch (e) {
  console.warn("Banner sync in vite.config notice:", e.message);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100, // Polls every 100ms for instant hot-reload on Ctrl+S
    },
    hmr: {
      overlay: true,
    },
    fs: {
      strict: false,
      allow: ['..', 'C:/Users/Forgeindiaconnect/.gemini'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
