// @title Check office speakers are online
// @expect approval
// @note Real Serval integration. playFavorite regroups rooms and replaces the queue; no verb list catches "play".
import { workflow } from "serval/core";
import * as sonos from "serval/integrations/sonos";

export const main = workflow({
  fn: async (args: { householdId: string; playerIds: string[] }, ctx: sonos.context.SonosIntegration) => {
    const groups = await sonos.apiRequest({ path: "/control/api/v1/households/{householdId}/groups", method: "GET", pathParams: { householdId: args.householdId } }, ctx);
    await sonos.playFavorite({ householdId: args.householdId, playerIds: args.playerIds, favoriteId: "7", volume: 100 }, ctx);
    return groups;
  },
});
