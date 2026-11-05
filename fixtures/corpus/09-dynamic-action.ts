// @title Apply lifecycle action from ticket
// @expect approval
// @note Operation picked at runtime from ticket text. Nothing static to see.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { userId: string; action: string }, ctx: okta.context.OktaIntegration) => {
    return okta.apiRequest({ path: `/api/v1/users/${args.userId}/lifecycle/${args.action}`, method: args.action === "status" ? "GET" : "POST" }, ctx);
  },
});
