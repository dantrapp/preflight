// @title Post a weekly license count summary in #it-ops
// @expect approval
// @note Reads M365 SKU counts but then posts a message to a Slack channel.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";
import * as slack from "serval/integrations/slack";

export const main = workflow({
  fn: async (
    args: { channel?: string; lowSeatThreshold?: number },
    ctx: graph.context.MicrosoftGraphIntegration & slack.context.SlackIntegration,
  ) => {
    const threshold = args.lowSeatThreshold ?? 5;
    const res: any = await graph.apiRequest(
      { path: "/v1.0/subscribedSkus" },
      ctx,
    );

    const rows = (res.value ?? []).map((s: any) => {
      const purchased = s.prepaidUnits?.enabled ?? 0;
      const assigned = s.consumedUnits ?? 0;
      return { sku: s.skuPartNumber, purchased, assigned, free: purchased - assigned };
    });

    const low = rows.filter((r: any) => r.purchased > 0 && r.free <= threshold);

    const lines = rows
      .filter((r: any) => r.purchased > 0)
      .map(
        (r: any) =>
          `• *${r.sku}*: ${r.assigned}/${r.purchased} assigned (${r.free} free)${
            r.free <= threshold ? " :warning:" : ""
          }`,
      );

    const text = [
      ":bar_chart: *Weekly Microsoft 365 license summary*",
      ...lines,
      low.length > 0
        ? `\n${low.length} SKU(s) at or below ${threshold} free seats.`
        : "\nAll SKUs have healthy headroom.",
    ].join("\n");

    const posted: any = await slack.chat.postMessage(
      { channel: args.channel ?? "#it-ops", text },
      ctx,
    );

    return { posted: posted.ok, ts: posted.ts, lowSeatSkus: low.map((r: any) => r.sku) };
  },
});
