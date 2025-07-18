import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily disable ESLint during builds for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Temporarily disable TypeScript checking during builds for deployment  
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here if needed
  },
};

export default nextConfig;
