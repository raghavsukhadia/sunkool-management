const { withSentryConfig } = require("@sentry/nextjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Avoid intermittent chunk/cache corruption in synced folders on Windows.
    if (dev) {
      config.cache = false
    }

    return config
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
})

