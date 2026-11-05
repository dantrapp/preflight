// @title Get manager, groups, and devices for a list of Entra users
// @expect read-only
// @note Uses POST /v1.0/$batch, but every sub-request is a GET; the batch itself is just a transport.
import { workflow } from "serval/core";
import * as microsoftGraph from "serval/integrations/microsoft-graph";

type BatchResponse = {
  responses: Array<{ id: string; status: number; body: any }>;
};

export const main = workflow({
  fn: async (
    args: { userPrincipalNames: string[] },
    ctx: microsoftGraph.context.MicrosoftGraphIntegration,
  ) => {
    const results: Record<string, { manager?: string; groups: string[]; devices: string[] }> = {};

    // $batch accepts at most 20 requests; 3 per user -> chunk by 6 users
    const chunkSize = 6;
    for (let i = 0; i < args.userPrincipalNames.length; i += chunkSize) {
      const chunk = args.userPrincipalNames.slice(i, i + chunkSize);
      const requests = chunk.flatMap((upn, idx) => [
        { id: `${idx}-mgr`, method: "GET", url: `/users/${encodeURIComponent(upn)}/manager?$select=displayName,mail` },
        { id: `${idx}-grp`, method: "GET", url: `/users/${encodeURIComponent(upn)}/memberOf?$select=displayName` },
        { id: `${idx}-dev`, method: "GET", url: `/users/${encodeURIComponent(upn)}/ownedDevices?$select=displayName,operatingSystem` },
      ]);

      const batch = (await microsoftGraph.apiRequest(
        { path: "/v1.0/$batch", method: "POST", body: { requests } },
        ctx,
      )) as BatchResponse;

      chunk.forEach((upn, idx) => {
        const get = (suffix: string) => batch.responses.find((r) => r.id === `${idx}-${suffix}`);
        const mgr = get("mgr");
        const grp = get("grp");
        const dev = get("dev");
        results[upn] = {
          manager: mgr && mgr.status === 200 ? mgr.body.displayName : undefined,
          groups: grp && grp.status === 200 ? grp.body.value.map((g: any) => g.displayName) : [],
          devices: dev && dev.status === 200 ? dev.body.value.map((d: any) => `${d.displayName} (${d.operatingSystem})`) : [],
        };
      });
    }

    return results;
  },
});
