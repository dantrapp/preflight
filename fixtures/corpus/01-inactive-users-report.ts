// @title List Okta users with no login in 90 days
// @expect read-only
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (_args: {}, ctx: okta.context.OktaIntegration) => {
    const users = await okta.apiRequest({ path: "/api/v1/users", method: "GET" }, ctx);
    const cutoff = Date.now() - 90 * 864e5;
    return users.filter((u: any) => new Date(u.lastLogin).getTime() < cutoff).map((u: any) => u.profile.email);
  },
});
