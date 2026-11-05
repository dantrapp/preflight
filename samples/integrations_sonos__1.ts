// @source https://docs.serval.com/sections/integrations/sonos.md
import { workflow } from "serval/core";
import * as sonos from "serval/integrations/sonos";

export const main = workflow({
  fn: async (_args: {}, ctx: sonos.context.SonosIntegration) => {
    const response = await sonos.apiRequest(
      { path: "/control/api/v1/households", method: "GET" },
      ctx,
    );
    const systems = [];

    for (const household of response.households ?? []) {
      const householdId = household.id;
      const groups = await sonos.apiRequest(
        {
          path: "/control/api/v1/households/{householdId}/groups",
          method: "GET",
          pathParams: { householdId },
        },
        ctx,
      );
      const favorites = await sonos.apiRequest(
        {
          path: "/control/api/v1/households/{householdId}/favorites",
          method: "GET",
          pathParams: { householdId },
        },
        ctx,
      );
      systems.push({
        householdId,
        partial: groups.partial ?? false,
        rooms: (groups.players ?? []).map((player) => ({
          playerId: player.id,
          name: player.name,
          capabilities: player.capabilities,
        })),
        favorites: favorites.items.map((item) => ({
          favoriteId: item.id,
          name: item.name,
        })),
      });
    }

    return { households: systems };
  },
});
