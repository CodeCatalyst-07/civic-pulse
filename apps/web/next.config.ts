import { loadEnvConfig } from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootEnv = loadEnvConfig(rootDirectory, true, console, true);

const nextConfig: NextConfig = {
  transpilePackages: ["@civicpulse/shared"],
  // The repository-wide .env is outside Next's default app directory. Expose
  // this intentionally public, browser-restricted Maps key at build time.
  env: {
    NEXT_PUBLIC_MAPS_BROWSER_KEY: rootEnv.combinedEnv.NEXT_PUBLIC_MAPS_BROWSER_KEY,
  },
};

export default nextConfig;
