// @source https://docs.serval.com/sections/integrations/sonos.md
import * as sonos from "serval/integrations/sonos";

const systems = await sonos.apiRequest(
  { path: "/control/api/v1/households", method: "GET" },
  ctx,
);

await sonos.playFavorite(
  {
    householdId: "YOUR_HOUSEHOLD_ID",
    playerIds: ["YOUR_PRIMARY_PLAYER_ID"],
    favoriteId: "YOUR_FAVORITE_ID",
    volume: 30,
  },
  ctx,
);
