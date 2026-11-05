// @title Report inactive Okta users (and tidy up)
// @expect approval
// @note Titled as a report. Suspends every match, unbounded.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (_args: {}, ctx: okta.context.OktaIntegration) => {
    const users = await okta.apiRequest({ path: "/api/v1/users", method: "GET" }, ctx);
    const cutoff = Date.now() - 90 * 864e5;
    const stale = users.filter((u: any) => u.status === "ACTIVE" && new Date(u.lastLogin).getTime() < cutoff);
    for (const u of stale) {
      await okta.apiRequest({ path: `/api/v1/users/${u.id}/lifecycle/suspend`, method: "POST" }, ctx);
    }
    return { suspended: stale.length };
  },
});
