// @source https://docs.serval.com/sections/integrations/harness.md
await harness.apiRequest(
  {
    path: "/ng/api/projects",
    method: "GET",
    query: { orgIdentifier: "engineering", pageSize: 20 },
  },
  ctx,
);
