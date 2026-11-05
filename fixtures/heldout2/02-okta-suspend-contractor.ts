// @title Suspend the contractor's Okta account while we sort out their contract
// @expect approval
// @note Calls the Okta suspend lifecycle operation, which changes the account state.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (
    args: { login: string; reason?: string },
    ctx: okta.context.OktaIntegration,
  ) => {
    const search = encodeURIComponent(`profile.login eq "${args.login}"`);
    const users: any[] = await okta.apiRequest(
      { path: `/api/v1/users?search=${search}&limit=1` },
      ctx,
    );

    if (users.length === 0) {
      throw new Error(`No Okta user found with login ${args.login}`);
    }

    const user = users[0];
    if (user.status !== "ACTIVE") {
      return { login: args.login, status: user.status, changed: false };
    }

    await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/lifecycle/suspend`, method: "POST" },
      ctx,
    );

    return {
      login: args.login,
      previousStatus: user.status,
      newStatus: "SUSPENDED",
      reason: args.reason ?? "contract review",
      changed: true,
    };
  },
});
