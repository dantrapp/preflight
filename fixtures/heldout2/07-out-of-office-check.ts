// @title Is Marcus's out-of-office on, and until when?
// @expect read-only
// @note Reads mailboxSettings for the auto-reply configuration; GET only.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: { userPrincipalName: string },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const upn = encodeURIComponent(args.userPrincipalName);
    const settings: any = await graph.apiRequest(
      { path: `/v1.0/users/${upn}/mailboxSettings`, method: "GET" },
      ctx,
    );

    const ar = settings.automaticRepliesSetting ?? {};
    const isOn = ar.status === "alwaysEnabled" || ar.status === "scheduled";

    return {
      user: args.userPrincipalName,
      autoReplyStatus: ar.status,
      isOn,
      externalAudience: ar.externalAudience,
      scheduledStart: ar.scheduledStartDateTime ?? null,
      scheduledEnd: ar.scheduledEndDateTime ?? null,
      internalMessagePreview: (ar.internalReplyMessage ?? "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 280),
      timeZone: settings.timeZone,
      workingHours: settings.workingHours,
    };
  },
});
