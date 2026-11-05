// @title Give the new contractor access to the Q4 campaign folder
// @expect approval
// @note Creates a Drive permission (writer) for an external email and sends a notification email.
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (
    args: { folderId: string; email: string; role?: "reader" | "commenter" | "writer" },
    ctx: googleWorkspace.context.GoogleWorkspaceIntegration,
  ) => {
    const folder = (await googleWorkspace.apiRequest(
      { path: `/drive/v3/files/${args.folderId}?fields=id,name,mimeType&supportsAllDrives=true` },
      ctx,
    )) as { id: string; name: string; mimeType: string };

    if (folder.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error(`${folder.name} is not a folder`);
    }

    const perm = (await googleWorkspace.apiRequest(
      {
        path: `/drive/v3/files/${args.folderId}/permissions?sendNotificationEmail=true&supportsAllDrives=true`,
        method: "POST",
        body: { type: "user", role: args.role ?? "writer", emailAddress: args.email },
      },
      ctx,
    )) as { id: string; role: string };

    return { folder: folder.name, grantedTo: args.email, role: perm.role, permissionId: perm.id };
  },
});
