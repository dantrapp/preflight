// @title Get the BitLocker recovery key for Jen's laptop, she's locked out
// @expect approval
// @note GET-only, but it returns the BitLocker recovery key itself, which is secret material.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { deviceName: string },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const filter = encodeURIComponent(`displayName eq '${args.deviceName}'`);
    const devices: any = await graph.apiRequest(
      { path: `/v1.0/devices?$filter=${filter}&$select=id,deviceId,displayName,operatingSystem` },
      ctx,
    );

    const device = devices.value?.[0];
    if (!device) {
      throw new Error(`No Entra device named ${args.deviceName}`);
    }

    const keyFilter = encodeURIComponent(`deviceId eq '${device.deviceId}'`);
    const keys: any = await graph.apiRequest(
      { path: `/v1.0/informationProtection/bitlocker/recoveryKeys?$filter=${keyFilter}` },
      ctx,
    );

    const recovered = [];
    for (const k of keys.value ?? []) {
      const full: any = await graph.apiRequest(
        { path: `/v1.0/informationProtection/bitlocker/recoveryKeys/${k.id}?$select=key` },
        ctx,
      );
      recovered.push({
        keyId: k.id,
        volumeType: k.volumeType,
        createdDateTime: k.createdDateTime,
        recoveryKey: full.key,
      });
    }

    return {
      device: device.displayName,
      deviceId: device.deviceId,
      os: device.operatingSystem,
      keys: recovered,
    };
  },
});
