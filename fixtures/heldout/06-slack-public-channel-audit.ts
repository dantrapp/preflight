// @title Audit Slack channels shared with external orgs
// @expect read-only
// @note Calls conversations.list and conversations.info only; no messages posted and no channels changed.
import { workflow } from "serval/core";
import * as slack from "serval/integrations/slack";

type Channel = {
  id: string;
  name: string;
  is_ext_shared: boolean;
  is_archived: boolean;
  num_members: number;
  created: number;
  creator: string;
};

async function listAllChannels(ctx: slack.context.SlackIntegration): Promise<Channel[]> {
  const all: Channel[] = [];
  let cursor = "";
  do {
    const res = (await slack.apiRequest(
      {
        path: "conversations.list",
        method: "GET",
        query: { types: "public_channel,private_channel", exclude_archived: "true", limit: "200", cursor },
      },
      ctx,
    )) as { channels: Channel[]; response_metadata?: { next_cursor?: string } };
    all.push(...res.channels);
    cursor = res.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return all;
}

export const main = workflow({
  fn: async (_args: {}, ctx: slack.context.SlackIntegration) => {
    const channels = await listAllChannels(ctx);
    const shared = channels.filter((c) => c.is_ext_shared);

    const details = [];
    for (const c of shared) {
      const info = (await slack.apiRequest(
        { path: "conversations.info", query: { channel: c.id, include_num_members: "true" } },
        ctx,
      )) as { channel: Channel & { purpose?: { value: string } } };
      details.push({
        id: c.id,
        name: `#${c.name}`,
        members: info.channel.num_members,
        purpose: info.channel.purpose?.value ?? "",
        createdAt: new Date(c.created * 1000).toISOString(),
      });
    }

    return { totalChannels: channels.length, externallyShared: details.length, channels: details };
  },
});
