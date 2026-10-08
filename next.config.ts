import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const networkHosts = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address),
);
const appHosts = [process.env.DEV_APP_URL, process.env.BETTER_AUTH_URL]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => new URL(origin).hostname);
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set([...networkHosts, ...appHosts])],
};

export default createNextIntlPlugin("./src/lib/i18n/request.ts")(nextConfig);
