// @title Offboard a departing employee
// Catalyst follow-up edit after review: "also handle their direct reports' shared access, and make sure sessions are killed"
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { userId: string }, ctx: any) => {
    await okta.apiRequest({ path: `/api/v1/users/${args.userId}/lifecycle/suspend`, method: "POST" }, ctx);
    await okta.apiRequest({ path: `/api/v1/users/${args.userId}/sessions`, method: "DELETE" }, ctx);
    const groups = await okta.apiRequest({ path: `/api/v1/users/${args.userId}/groups` }, ctx);
    for (const g of groups) {
      await okta.apiRequest({ path: `/api/v1/groups/${g.id}/users/${args.userId}`, method: "DELETE" }, ctx);
    }
  },
});
