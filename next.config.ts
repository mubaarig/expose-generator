import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Auf dieses Verzeichnis pinnen — sonst wählt Turbopack wegen eines
  // fremden package-lock.json im Home-Verzeichnis den falschen Root.
  turbopack: { root: __dirname },
};

export default nextConfig;
