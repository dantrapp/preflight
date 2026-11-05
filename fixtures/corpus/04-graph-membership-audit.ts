// @title Which Entra groups is this user in?
// @expect read-only
// @note POST /getMemberGroups is read-only.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (args: { userId: string }, ctx: graph.context.GraphIntegration) => {
    return graph.apiRequest({ path: `/v1.0/users/${args.userId}/getMemberGroups`, method: "POST", body: { securityEnabledOnly: true } }, ctx);
  },
});
