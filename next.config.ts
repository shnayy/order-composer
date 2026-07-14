import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.GITHUB_PAGES_BUILD === "true";
const basePath = isGitHubPagesBuild ? process.env.PAGES_BASE_PATH ?? "" : "";

const nextConfig: NextConfig = {
  output: isGitHubPagesBuild ? "export" : undefined,
  trailingSlash: isGitHubPagesBuild,
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
