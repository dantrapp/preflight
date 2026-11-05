// @title Who owns the eng-all and eng-oncall Google Groups?
// @expect read-only
// @note Lists group metadata and OWNER-role members for each group; GETs only.
import { workflow } from "serval/core";
import * as gws from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (
    args: { groupEmails: string[] },
    ctx: gws.context.GoogleWorkspaceIntegration,
  ) => {
    const results = [];
    for (const groupEmail of args.groupEmails) {
      const key = encodeURIComponent(groupEmail);
      const group: any = await gws.apiRequest(
        { path: `/admin/directory/v1/groups/${key}` },
        ctx,
      );
      const owners: any = await gws.apiRequest(
        { path: `/admin/directory/v1/groups/${key}/members?roles=OWNER&maxResults=200` },
        ctx,
      );
      const managers: any = await gws.apiRequest(
        { path: `/admin/directory/v1/groups/${key}/members?roles=MANAGER&maxResults=200` },
        ctx,
      );

      const ownerList = (owners.members ?? []).map((m: any) => ({
        email: m.email,
        type: m.type,
        status: m.status,
      }));

      results.push({
        group: groupEmail,
        name: group.name,
        directMembersCount: Number(group.directMembersCount ?? 0),
        owners: ownerList,
        managers: (managers.members ?? []).map((m: any) => m.email),
        hasNoOwner: ownerList.length === 0,
      });
    }
    return { groups: results };
  },
});
