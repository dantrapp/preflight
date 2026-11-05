// @title Show a user's existing backup codes
// @expect approval
// @note Truly read-only, but returns secret material into run history (docs: run records don't recheck viewer access).
import { workflow } from "serval/core";
import * as gws from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (args: { email: string }, ctx: gws.context.GoogleWorkspaceIntegration) => {
    return gws.apiRequest({ path: `/admin/directory/v1/users/${args.email}/verificationCodes` }, ctx);
  },
});
