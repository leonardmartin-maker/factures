/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "factures.swissworkingdev.ch"],
    },
  },
};

export default nextConfig;
