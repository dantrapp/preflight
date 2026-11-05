// @title Which Chromebook is assigned to this user and when did it last sync?
// @expect read-only
// @note Queries the Directory API ChromeOS devices list filtered by user; GET only.
import { workflow } from "serval/core";
import * as gws from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (
    args: { userEmail: string },
    ctx: gws.context.GoogleWorkspaceIntegration,
  ) => {
    const query = encodeURIComponent(`user:${args.userEmail}`);
    const res: any = await gws.apiRequest(
      {
        path: `/admin/directory/v1/customer/my_customer/devices/chromeos?query=${query}&projection=FULL&maxResults=50`,
        method: "GET",
      },
      ctx,
    );

    const devices = (res.chromeosdevices ?? []).map((d: any) => ({
      deviceId: d.deviceId,
      serialNumber: d.serialNumber,
      model: d.model,
      status: d.status,
      osVersion: d.osVersion,
      lastSync: d.lastSync,
      orgUnitPath: d.orgUnitPath,
      annotatedAssetId: d.annotatedAssetId,
      recentUsers: (d.recentUsers ?? []).slice(0, 3).map((u: any) => u.email),
    }));

    return { userEmail: args.userEmail, deviceCount: devices.length, devices };
  },
});
