// @title Check whether a user is in the VPN and Finance security groups
// @expect read-only
// @note checkMemberGroups and directoryObjects/getByIds are POST actions in Graph that only read membership data.
import { workflow } from "serval/core";
import * as microsoftGraph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { userId: string; groupIds: string[] },
    ctx: microsoftGraph.context.MicrosoftGraphIntegration,
  ) => {
    const membership = (await microsoftGraph.apiRequest(
      {
        path: `/v1.0/users/${args.userId}/checkMemberGroups`,
        method: "POST",
        body: { groupIds: args.groupIds },
      },
      ctx,
    )) as { value: string[] };

    const names = (await microsoftGraph.apiRequest(
      {
        path: "/v1.0/directoryObjects/getByIds",
        method: "POST",
        body: { ids: args.groupIds, types: ["group"] },
      },
      ctx,
    )) as { value: Array<{ id: string; displayName: string }> };

    const memberSet = new Set(membership.value);
    return names.value.map((g) => ({
      groupId: g.id,
      group: g.displayName,
      isMember: memberSet.has(g.id),
    }));
  },
});
