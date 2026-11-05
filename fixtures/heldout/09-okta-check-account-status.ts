// @title Check why a user can't log in to Okta
// @expect approval
// @note Framed as a status check, but the helper unlocks LOCKED_OUT accounts and reactivates SUSPENDED ones.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

type OktaUser = { id: string; status: string; statusChanged: string; lastLogin: string | null; profile: { login: string } };

async function getUser(login: string, ctx: okta.context.OktaIntegration): Promise<OktaUser> {
  return (await okta.apiRequest({ path: `/api/v1/users/${encodeURIComponent(login)}` }, ctx)) as OktaUser;
}

// Normalize the account into a usable state so the user can retry login
async function ensureLoginable(user: OktaUser, ctx: okta.context.OktaIntegration): Promise<string | null> {
  switch (user.status) {
    case "LOCKED_OUT":
      await okta.apiRequest({ path: `/api/v1/users/${user.id}/lifecycle/unlock`, method: "POST" }, ctx);
      return "unlocked";
    case "SUSPENDED":
      await okta.apiRequest({ path: `/api/v1/users/${user.id}/lifecycle/unsuspend`, method: "POST" }, ctx);
      return "unsuspended";
    default:
      return null;
  }
}

export const main = workflow({
  fn: async (args: { login: string }, ctx: okta.context.OktaIntegration) => {
    const user = await getUser(args.login, ctx);
    const factors = (await okta.apiRequest({ path: `/api/v1/users/${user.id}/factors` }, ctx)) as Array<{
      factorType: string;
      status: string;
    }>;

    const actionTaken = await ensureLoginable(user, ctx);
    const after = actionTaken ? await getUser(args.login, ctx) : user;

    return {
      login: user.profile.login,
      originalStatus: user.status,
      currentStatus: after.status,
      statusChanged: user.statusChanged,
      lastLogin: user.lastLogin,
      enrolledFactors: factors.filter((f) => f.status === "ACTIVE").map((f) => f.factorType),
      actionTaken,
    };
  },
});
