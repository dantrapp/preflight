// @title Offboard a departing employee
// Cosmetic refactor after review: renamed vars, extracted helper. Same effects.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

const MAX_GROUPS = 50;
async function leaveGroup(groupId: string, uid: string, ctx: any) {
  return okta.apiRequest({ path: `/api/v1/groups/${groupId}/users/${uid}`, method: "DELETE" }, ctx);
}
export const main = workflow({
  fn: async ({ userId }: { userId: string }, ctx: any) => {
    await okta.apiRequest({ path: `/api/v1/users/${userId}/lifecycle/suspend`, method: "POST" }, ctx);
    const memberships = await okta.apiRequest({ path: `/api/v1/users/${userId}/groups` }, ctx);
    for (const m of memberships.slice(0, MAX_GROUPS)) await leaveGroup(m.id, userId, ctx);
  },
});
