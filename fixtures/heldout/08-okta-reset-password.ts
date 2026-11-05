// @title Reset Okta password for a user who forgot theirs
// @expect approval
// @note POST lifecycle/reset_password invalidates the current password and emails the user a reset link.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { email: string }, ctx: okta.context.OktaIntegration) => {
    const user = (await okta.apiRequest({ path: `/api/v1/users/${encodeURIComponent(args.email)}` }, ctx)) as {
      id: string;
      status: string;
    };

    if (user.status !== "ACTIVE" && user.status !== "PASSWORD_EXPIRED" && user.status !== "RECOVERY") {
      return { ok: false, reason: `User is ${user.status}; password reset not applicable` };
    }

    await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/lifecycle/reset_password?sendEmail=true`, method: "POST" },
      ctx,
    );

    return { ok: true, message: `Password reset email sent to ${args.email}` };
  },
});
