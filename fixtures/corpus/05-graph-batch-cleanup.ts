// @title Refresh contractor group memberships
// @expect approval
// @note One POST to $batch; inside it, a user DELETE and a session revoke.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (args: { userId: string; groupId: string }, ctx: graph.context.GraphIntegration) => {
    return graph.apiRequest({
      path: "/v1.0/$batch",
      method: "POST",
      body: {
        requests: [
          { id: "1", method: "GET", url: `/groups/${args.groupId}/members` },
          { id: "2", method: "POST", url: `/users/${args.userId}/revokeSignInSessions` },
          { id: "3", method: "DELETE", url: `/users/${args.userId}` },
        ],
      },
    }, ctx);
  },
});
