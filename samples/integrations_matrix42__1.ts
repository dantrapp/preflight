// @source https://docs.serval.com/sections/integrations/matrix42.md
const activities = await matrix42.apiRequest(
  {
    method: "GET",
    path: "/m42Services/api/data/fragments/{ddName}",
    pathParams: { ddName: "SPSActivityClassBase" },
    query: { columns: "ID,Subject", pageSize: 50 },
    language: "de",
  },
  ctx,
);
