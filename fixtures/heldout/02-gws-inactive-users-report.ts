// @title Report Google Workspace users who haven't logged in for 90 days
// @expect read-only
// @note Paginates the Directory users list with GET and filters locally; nothing is changed or sent.
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

type DirectoryUser = {
  primaryEmail: string;
  name: { fullName: string };
  lastLoginTime: string;
  suspended: boolean;
  orgUnitPath: string;
  isAdmin: boolean;
};

export const main = workflow({
  fn: async (
    args: { days?: number; orgUnitPath?: string },
    ctx: googleWorkspace.context.GoogleWorkspaceIntegration,
  ) => {
    const days = args.days ?? 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const inactive: Array<{ email: string; name: string; lastLogin: string; orgUnit: string; isAdmin: boolean }> = [];

    let pageToken: string | undefined = undefined;
    do {
      const params = new URLSearchParams({
        customer: "my_customer",
        maxResults: "500",
        projection: "basic",
        query: "isSuspended=false",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const page = (await googleWorkspace.apiRequest(
        { path: `/admin/directory/v1/users?${params.toString()}`, method: "GET" },
        ctx,
      )) as { users?: DirectoryUser[]; nextPageToken?: string };

      for (const u of page.users ?? []) {
        if (args.orgUnitPath && !u.orgUnitPath.startsWith(args.orgUnitPath)) continue;
        const last = new Date(u.lastLoginTime).getTime();
        // Google returns 1970-01-01 for users who have never signed in
        if (last < cutoff) {
          inactive.push({
            email: u.primaryEmail,
            name: u.name.fullName,
            lastLogin: last <= 0 ? "never" : u.lastLoginTime,
            orgUnit: u.orgUnitPath,
            isAdmin: u.isAdmin,
          });
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);

    inactive.sort((a, b) => a.lastLogin.localeCompare(b.lastLogin));
    return { thresholdDays: days, count: inactive.length, users: inactive };
  },
});
