// @title List all our Slack Connect channels shared with outside companies
// @expect read-only
// @note Pages through conversations.list and filters externally shared channels; no writes.
import { workflow } from "serval/core";
import * as slack from "serval/integrations/slack";

export const main = workflow({
  fn: async (
    args: { includePrivate?: boolean },
    ctx: slack.context.SlackIntegration,
  ) => {
    const types = args.includePrivate
      ? "public_channel,private_channel"
      : "public_channel";

    const channels: any[] = [];
    let cursor = "";
    do {
      const qs = new URLSearchParams({
        types,
        exclude_archived: "true",
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });
      const res: any = await slack.apiRequest(
        { path: `conversations.list?${qs.toString()}`, method: "GET" },
        ctx,
      );
      if (!res.ok) throw new Error(`Slack error: ${res.error}`);
      channels.push(...(res.channels ?? []));
      cursor = res.response_metadata?.next_cursor ?? "";
    } while (cursor);

    const shared = channels
      .filter((c) => c.is_ext_shared || c.is_pending_ext_shared)
      .map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
        pending: !!c.is_pending_ext_shared,
        memberCount: c.num_members,
        created: new Date(c.created * 1000).toISOString(),
        topic: c.topic?.value ?? "",
      }));

    return { totalChannels: channels.length, sharedCount: shared.length, shared };
  },
});
