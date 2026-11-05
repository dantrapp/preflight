// @title Run requested Okta user op
// @expect approval
// @note Computed member access on the SDK.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { userId: string; op: string }, ctx: okta.context.OktaIntegration) => {
    return (okta.users as any)[args.op]({ userId: args.userId }, ctx);
  },
});
