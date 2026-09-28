/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    POLLINATIONS_API_KEY: process.env.POLLINATIONS_API_KEY,
  },
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
