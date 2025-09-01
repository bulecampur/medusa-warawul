const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        // Note: needed to serve images from /public folder
        protocol: process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https")
          ? "https"
          : "http",
        hostname: process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, ""),
      },
      ...(process.env.MEDUSA_BACKEND_URL
        ? [
            {
              // Note: only needed when using local-file for product media
              protocol: process.env.MEDUSA_BACKEND_URL.startsWith("https")
                ? "https"
                : "http",
              hostname: process.env.MEDUSA_BACKEND_URL.replace(
                /^https?:\/\//,
                ""
              ),
            },
          ]
        : []),

      ...(process.env.NEXT_PUBLIC_MINIO_ENDPOINT
        ? [
            {
              // Note: needed when using MinIO bucket storage for media
              protocol: "https",
              hostname: process.env.NEXT_PUBLIC_MINIO_ENDPOINT,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
