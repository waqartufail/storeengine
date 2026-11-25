import { defineConfig } from "vite";
export default defineConfig({
  server: {
    cors: false,
    host: "0.0.0.0",
    proxy: {
      "/api": process.env.API_ORIGIN || "http://127.0.0.1:8080",
      "/health": process.env.API_ORIGIN || "http://127.0.0.1:8080",
    },
  },
});
