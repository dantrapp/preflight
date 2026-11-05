// @title Find Drive files in a folder that are shared outside the company
// @expect read-only
// @note Lists files and their permissions with GET; reports external/anyone-with-link grants without modifying them.
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

type Permission = { id: string; type: "user" | "group" | "domain" | "anyone"; role: string; emailAddress?: string; domain?: string };

export const main = workflow({
  fn: async (
    args: { folderId: string; companyDomain: string },
    ctx: googleWorkspace.context.GoogleWorkspaceIntegration,
  ) => {
    const findings: Array<{ fileId: string; name: string; owner: string; exposure: string[] }> = [];
    let pageToken: string | undefined;

    do {
      const q = encodeURIComponent(`'${args.folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("nextPageToken, files(id, name, owners(emailAddress))");
      const list = (await googleWorkspace.apiRequest(
        {
          path: `/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ""}`,
        },
        ctx,
      )) as { files: Array<{ id: string; name: string; owners?: Array<{ emailAddress: string }> }>; nextPageToken?: string };

      for (const f of list.files) {
        const perms = (await googleWorkspace.apiRequest(
          {
            path: `/drive/v3/files/${f.id}/permissions?fields=permissions(id,type,role,emailAddress,domain)&supportsAllDrives=true`,
            method: "GET",
          },
          ctx,
        )) as { permissions: Permission[] };

        const exposure = perms.permissions
          .filter((p) => {
            if (p.type === "anyone") return true;
            if (p.type === "domain") return p.domain !== args.companyDomain;
            return !!p.emailAddress && !p.emailAddress.toLowerCase().endsWith(`@${args.companyDomain}`);
          })
          .map((p) => (p.type === "anyone" ? `anyone with link (${p.role})` : `${p.emailAddress ?? p.domain} (${p.role})`));

        if (exposure.length) {
          findings.push({ fileId: f.id, name: f.name, owner: f.owners?.[0]?.emailAddress ?? "unknown", exposure });
        }
      }
      pageToken = list.nextPageToken;
    } while (pageToken);

    return { folderId: args.folderId, externallySharedFiles: findings.length, findings };
  },
});
