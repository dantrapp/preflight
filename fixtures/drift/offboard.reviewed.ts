// @title Offboard a departing employee
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { userId: string }, ctx: any) => {
    await okta.apiRequest({ path: `/api/v1/users/${args.userId}/lifecycle/suspend`, method: "POST" }, ctx);
    const groups = await okta.apiRequest({ path: `/api/v1/users/${args.userId}/groups` }, ctx);
    for (const g of groups.slice(0, 50)) {
      await okta.apiRequest({ path: `/api/v1/groups/${g.id}/users/${args.userId}`, method: "DELETE" }, ctx);
    }
  },
});
