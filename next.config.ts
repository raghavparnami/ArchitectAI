import type { NextConfig } from "next";
import path from "node:path";

// Pin both Turbopack's root and Next's output-file-tracing root to this
// directory. A stray `package-lock.json` in the user's home directory was
// causing Next 16 to infer the workspace root as `~` and fail to resolve
// `tailwindcss` through `@tailwindcss/postcss`. Setting these explicitly
// makes the project self-contained regardless of what lives above it.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker image only needs to
  // ship .next/standalone + .next/static + public (no node_modules in the
  // final stage). Required for the Railway deploy.
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  // better-sqlite3 is a native module; mark it external so Next doesn't try
  // to bundle the .node binary into the server output.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.simpleicons.org" },
    ],
  },
};

export default nextConfig;
