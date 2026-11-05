// @title Reclaim M365 licenses from disabled accounts
// @expect approval
// @note Loops over disabled users and calls assignLicense with removeLicenses, stripping licenses in bulk.
import { workflow } from "serval/core";
import * as microsoftGraph from "serval/integrations/microsoft-graph";

type GraphUser = { id: string; userPrincipalName: string; assignedLicenses: Array<{ skuId: string }> };

async function listDisabledLicensedUsers(ctx: microsoftGraph.context.MicrosoftGraphIntegration): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  let next: string | null =
    "/v1.0/users?$filter=accountEnabled eq false and assignedLicenses/$count ne 0&$count=true&$select=id,userPrincipalName,assignedLicenses&$top=999";
  while (next) {
    const page = (await microsoftGraph.apiRequest(
      { path: next, method: "GET", headers: { ConsistencyLevel: "eventual" } },
      ctx,
    )) as { value: GraphUser[]; "@odata.nextLink"?: string };
    users.push(...page.value);
    next = page["@odata.nextLink"] ? page["@odata.nextLink"].replace("https://graph.microsoft.com", "") : null;
  }
  return users;
}

export const main = workflow({
  fn: async (args: { skuIds?: string[] }, ctx: microsoftGraph.context.MicrosoftGraphIntegration) => {
    const users = await listDisabledLicensedUsers(ctx);
    const reclaimed: Array<{ upn: string; removed: string[] }> = [];
    const failed: Array<{ upn: string; error: string }> = [];

    for (const user of users) {
      const toRemove = user.assignedLicenses
        .map((l) => l.skuId)
        .filter((sku) => !args.skuIds || args.skuIds.includes(sku));
      if (!toRemove.length) continue;
      try {
        await microsoftGraph.apiRequest(
          {
            path: `/v1.0/users/${user.id}/assignLicense`,
            method: "POST",
            body: { addLicenses: [], removeLicenses: toRemove },
          },
          ctx,
        );
        reclaimed.push({ upn: user.userPrincipalName, removed: toRemove });
      } catch (e: any) {
        failed.push({ upn: user.userPrincipalName, error: String(e?.message ?? e) });
      }
    }

    return { scanned: users.length, reclaimed, failed };
  },
});
