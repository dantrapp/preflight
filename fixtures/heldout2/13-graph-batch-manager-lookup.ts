// @title Who are the managers for these five people?
// @expect read-only
// @note Uses POST /$batch but every subrequest is a GET for user profiles and managers.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { userPrincipalNames: string[] },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const upns = args.userPrincipalNames.slice(0, 10);
    const requests = upns.flatMap((upn, i) => [
      {
        id: `u${i}`,
        method: "GET",
        url: `/users/${encodeURIComponent(upn)}?$select=id,displayName,jobTitle,department,accountEnabled`,
      },
      {
        id: `m${i}`,
        method: "GET",
        url: `/users/${encodeURIComponent(upn)}/manager?$select=displayName,mail,jobTitle`,
      },
    ]);

    const res: any = await graph.apiRequest(
      { path: "/v1.0/$batch", method: "POST", body: { requests } },
      ctx,
    );

    const byId: Record<string, any> = {};
    for (const r of res.responses ?? []) byId[r.id] = r;

    return {
      people: upns.map((upn, i) => {
        const u = byId[`u${i}`];
        const m = byId[`m${i}`];
        return {
          upn,
          found: u?.status === 200,
          displayName: u?.body?.displayName,
          jobTitle: u?.body?.jobTitle,
          department: u?.body?.department,
          accountEnabled: u?.body?.accountEnabled,
          manager:
            m?.status === 200
              ? { name: m.body.displayName, email: m.body.mail, title: m.body.jobTitle }
              : null,
        };
      }),
    };
  },
});
