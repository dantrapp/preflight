// @title How many M365 licenses do we have left?
// @expect read-only
// @note Reads subscribedSkus and computes consumed vs. available seats; GET only.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { skuFilter?: string },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const res: any = await graph.apiRequest(
      {
        path: "/v1.0/subscribedSkus?$select=skuId,skuPartNumber,consumedUnits,prepaidUnits,capabilityStatus",
      },
      ctx,
    );

    const skus = (res.value ?? [])
      .filter((s: any) =>
        args.skuFilter
          ? s.skuPartNumber.toLowerCase().includes(args.skuFilter.toLowerCase())
          : true,
      )
      .map((s: any) => {
        const enabled = s.prepaidUnits?.enabled ?? 0;
        const consumed = s.consumedUnits ?? 0;
        return {
          sku: s.skuPartNumber,
          status: s.capabilityStatus,
          purchased: enabled,
          assigned: consumed,
          available: enabled - consumed,
          warning: s.prepaidUnits?.warning ?? 0,
          suspended: s.prepaidUnits?.suspended ?? 0,
          utilizationPct: enabled > 0 ? Math.round((consumed / enabled) * 100) : null,
        };
      })
      .sort((a: any, b: any) => a.available - b.available);

    return { skus };
  },
});
