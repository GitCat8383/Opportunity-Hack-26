/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
};

module.exports = nextConfig;
