import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workflow-lab compose/templates routes read labs/workflow/templates/
  // from the filesystem at request time; static analysis can't see those files.
  outputFileTracingIncludes: {
    "/api/labs/workflow/*": ["./labs/workflow/templates/**/*"],
  },
  // Legacy URLs from lab renames/graduations. Declared here (not as page-level
  // redirect()) because a statically prerendered page can't emit an HTTP
  // redirect in the production build.
  async redirects() {
    return [
      { source: "/lab", destination: "/labs/motion", permanent: true },
      { source: "/labs/image", destination: "/labs/workflow", permanent: true },
      { source: "/labs/campaign", destination: "/campaigns", permanent: true },
    ];
  },
};

export default nextConfig;
