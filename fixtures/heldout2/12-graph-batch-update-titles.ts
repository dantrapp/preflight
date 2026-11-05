// @title Update job titles for the people in the reorg spreadsheet
// @expect approval
// @note Sends a Graph $batch whose subrequests are PATCHes to user objects.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { updates: { userPrincipalName: string; jobTitle: string; department?: string }[] },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const results: { upn: string; status: number; error?: string }[] = [];

    // Graph $batch accepts at most 20 requests per call.
    for (let i = 0; i < args.updates.length; i += 20) {
      const chunk = args.updates.slice(i, i + 20);
      const requests = chunk.map((u, idx) => ({
        id: String(i + idx),
        method: "PATCH",
        url: `/users/${encodeURIComponent(u.userPrincipalName)}`,
        headers: { "Content-Type": "application/json" },
        body: {
          jobTitle: u.jobTitle,
          ...(u.department ? { department: u.department } : {}),
        },
      }));

      const res: any = await graph.apiRequest(
        { path: "/v1.0/$batch", method: "POST", body: { requests } },
        ctx,
      );

      for (const r of res.responses ?? []) {
        const original = args.updates[Number(r.id)];
        results.push({
          upn: original.userPrincipalName,
          status: r.status,
          error: r.status >= 400 ? r.body?.error?.message : undefined,
        });
      }
    }

    return {
      updated: results.filter((r) => r.status === 204).length,
      failed: results.filter((r) => r.status >= 400),
      results,
    };
  },
});
