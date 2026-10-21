import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chokidar", "proper-lockfile", "fsevents"],
};

export default nextConfig;
