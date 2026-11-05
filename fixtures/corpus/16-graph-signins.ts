// @title Recent failed sign-ins for a user
// @expect read-only
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (args: { upn: string }, ctx: any) => {
    const u = await graph.apiRequest({ path: `/v1.0/users/${args.upn}` }, ctx);
    return graph.apiRequest({ path: `/v1.0/auditLogs/signIns?$filter=userId eq '${u.id}'` }, ctx);
  },
});
