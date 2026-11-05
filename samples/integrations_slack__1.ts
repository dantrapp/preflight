// @source https://docs.serval.com/sections/integrations/slack.md
const channels = await serval.apiRequest({
  method: "GET",
  path: "/v2/teams/{team_id}/connected-channels",
  pathParams: { team_id: teamId },
  query: { serviceInstanceId },
}, undefined);

const channel = (channels.data ?? []).find(
  (entry) => entry.serviceChannelId === slackChannelId,
);
if (!channel?.id) {
  throw new Error("Channel is not available in this workspace's connected channels.");
}

await serval.apiRequest({
  method: "PUT",
  path: "/v2/teams/{team_id}/connected-channels/{id}/mode",
  pathParams: { team_id: teamId, id: channel.id },
  body: { mode: "CONNECTED_SERVICE_MODE_FULL_ASSIST" },
}, undefined);
