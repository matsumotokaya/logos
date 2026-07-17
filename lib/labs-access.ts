// Labs are internal R&D surfaces (see labs/README.md). In production they
// stay hidden unless the deployment explicitly opts in with LABS_ENABLED=1;
// development always has them. Prod-facing endpoints that presentations
// depend on (workflow compose, workflow runs) must NOT use this gate.
export function labsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.LABS_ENABLED === "1"
  );
}

export function labsDisabledResponse(): Response {
  return Response.json({ error: "Not found." }, { status: 404 });
}
