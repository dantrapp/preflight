// @title What apps does this person have in Okta?
// @expect read-only
// @note Looks up a user by login and lists their assigned app links; GETs only.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { email: string }, ctx: okta.context.OktaIntegration) => {
    const user: any = await okta.apiRequest(
      { path: `/api/v1/users/${encodeURIComponent(args.email)}` },
      ctx,
    );

    const appLinks: any[] = await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/appLinks`, method: "GET" },
      ctx,
    );

    return {
      user: {
        id: user.id,
        login: user.profile?.login,
        status: user.status,
      },
      appCount: appLinks.length,
      apps: appLinks.map((a) => ({
        label: a.label,
        appName: a.appName,
        appInstanceId: a.appInstanceId,
      })),
    };
  },
});
