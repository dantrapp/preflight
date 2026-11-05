// @title Unlock up to 5 locked-out users from a ticket
// @expect approval
// @note A write, but bounded and reversible: low risk, approval still required.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

const MAX = 5;
export const main = workflow({
  fn: async (args: { userIds: string[] }, ctx: any) => {
    for (const id of args.userIds.slice(0, MAX)) {
      await okta.apiRequest({ path: `/api/v1/users/${id}/lifecycle/unlock`, method: "POST" }, ctx);
    }
  },
});
