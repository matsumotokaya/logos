import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image-lab compose/templates routes read labs/image/templates/ from
  // the filesystem at request time; static analysis can't see those files.
  outputFileTracingIncludes: {
    "/api/labs/image/*": ["./labs/image/templates/**/*"],
  },
};

export default nextConfig;
