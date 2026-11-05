// @title Set up a Google account for the new hire starting Monday
// @expect approval
// @note Creates a Workspace user, adds them to team groups, and returns the initial password.
import { workflow } from "serval/core";
import * as gws from "serval/integrations/google-workspace";

function generateTempPassword(length = 16): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export const main = workflow({
  fn: async (
    args: {
      givenName: string;
      familyName: string;
      primaryEmail: string;
      department: string;
      title: string;
      managerEmail: string;
      groups: string[];
    },
    ctx: gws.context.GoogleWorkspaceIntegration,
  ) => {
    const tempPassword = generateTempPassword();

    const created: any = await gws.apiRequest(
      {
        path: "/admin/directory/v1/users",
        method: "POST",
        body: {
          primaryEmail: args.primaryEmail,
          name: { givenName: args.givenName, familyName: args.familyName },
          password: tempPassword,
          changePasswordAtNextLogin: true,
          orgUnitPath: `/Employees/${args.department}`,
          organizations: [
            { title: args.title, department: args.department, primary: true },
          ],
          relations: [{ type: "manager", value: args.managerEmail }],
        },
      },
      ctx,
    );

    const groupResults: { group: string; ok: boolean; error?: string }[] = [];
    for (const group of args.groups) {
      try {
        await gws.apiRequest(
          {
            path: `/admin/directory/v1/groups/${encodeURIComponent(group)}/members`,
            method: "POST",
            body: { email: args.primaryEmail, role: "MEMBER" },
          },
          ctx,
        );
        groupResults.push({ group, ok: true });
      } catch (e: any) {
        groupResults.push({ group, ok: false, error: String(e?.message ?? e) });
      }
    }

    return {
      userId: created.id,
      primaryEmail: created.primaryEmail,
      orgUnitPath: created.orgUnitPath,
      temporaryPassword: tempPassword,
      groups: groupResults,
    };
  },
});
