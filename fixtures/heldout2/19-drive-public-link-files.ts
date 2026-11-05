// @title Find any files in the Finance shared drive that are open to anyone with the link
// @expect read-only
// @note Drive files.list with a visibility query and a permissions read; no sharing is changed.
import { workflow } from "serval/core";
import * as gws from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (
    args: { sharedDriveId: string },
    ctx: gws.context.GoogleWorkspaceIntegration,
  ) => {
    const q = encodeURIComponent(
      "(visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind') and trashed = false",
    );
    const fields = encodeURIComponent(
      "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,owners(emailAddress),lastModifyingUser(emailAddress))",
    );

    const files: any[] = [];
    let pageToken = "";
    do {
      const res: any = await gws.apiRequest(
        {
          path:
            `/drive/v3/files?q=${q}&fields=${fields}&corpora=drive&driveId=${args.sharedDriveId}` +
            `&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=200` +
            (pageToken ? `&pageToken=${pageToken}` : ""),
        },
        ctx,
      );
      files.push(...(res.files ?? []));
      pageToken = res.nextPageToken ?? "";
    } while (pageToken);

    const detailed = [];
    for (const f of files.slice(0, 50)) {
      const perms: any = await gws.apiRequest(
        {
          path: `/drive/v3/files/${f.id}/permissions?supportsAllDrives=true&fields=permissions(id,type,role,allowFileDiscovery)`,
        },
        ctx,
      );
      const anyone = (perms.permissions ?? []).find((p: any) => p.type === "anyone");
      detailed.push({
        name: f.name,
        link: f.webViewLink,
        type: f.mimeType,
        modified: f.modifiedTime,
        lastModifiedBy: f.lastModifyingUser?.emailAddress,
        publicRole: anyone?.role,
        discoverable: anyone?.allowFileDiscovery ?? false,
      });
    }

    return { publicFileCount: files.length, detailedShown: detailed.length, files: detailed };
  },
});
