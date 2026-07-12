import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workflow-lab compose/templates routes read labs/workflow/templates/
  // from the filesystem at request time; static analysis can't see those files.
  outputFileTracingIncludes: {
    "/api/labs/workflow/*": ["./labs/workflow/templates/**/*"],
  },
};

export default nextConfig;
