// @title Offboard a manager's team
// @expect approval
// @note The destructive call lives in a helper; the loop is at the call site.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

async function revoke(userId: string, ctx: any) {
  await okta.apiRequest({ path: `/api/v1/users/${userId}/sessions`, method: "DELETE" }, ctx);
  await okta.apiRequest({ path: `/api/v1/users/${userId}/lifecycle/reset_factors`, method: "POST" }, ctx);
}

export const main = workflow({
  fn: async (args: { managerId: string }, ctx: any) => {
    const users = await okta.apiRequest({ path: "/api/v1/users", method: "GET" }, ctx);
    const team = users.filter((u: any) => u.profile.managerId === args.managerId);
    await Promise.all(team.map((u: any) => revoke(u.id, ctx)));
  },
});
