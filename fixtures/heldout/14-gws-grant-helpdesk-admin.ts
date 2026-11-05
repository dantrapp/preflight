// @title Make Priya a helpdesk admin in Google Workspace
// @expect approval
// @note Creates a Directory roleAssignment, granting an admin role (privilege escalation).
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (
    args: { userEmail: string; roleName?: string },
    ctx: googleWorkspace.context.GoogleWorkspaceIntegration,
  ) => {
    const roleName = args.roleName ?? "_HELP_DESK_ADMIN_ROLE";

    const user = (await googleWorkspace.apiRequest(
      { path: `/admin/directory/v1/users/${encodeURIComponent(args.userEmail)}?fields=id,primaryEmail` },
      ctx,
    )) as { id: string; primaryEmail: string };

    const roles = (await googleWorkspace.apiRequest(
      { path: "/admin/directory/v1/customer/my_customer/roles?maxResults=100" },
      ctx,
    )) as { items: Array<{ roleId: string; roleName: string }> };

    const role = roles.items.find((r) => r.roleName === roleName);
    if (!role) throw new Error(`Role ${roleName} not found`);

    const assignment = (await googleWorkspace.apiRequest(
      {
        path: "/admin/directory/v1/customer/my_customer/roleassignments",
        method: "POST",
        body: { roleId: role.roleId, assignedTo: user.id, scopeType: "CUSTOMER" },
      },
      ctx,
    )) as { roleAssignmentId: string };

    return { user: user.primaryEmail, role: roleName, roleAssignmentId: assignment.roleAssignmentId };
  },
});
