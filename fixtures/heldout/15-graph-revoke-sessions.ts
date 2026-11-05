// @title Sign a user out of everything after a phishing report
// @expect approval
// @note POST revokeSignInSessions invalidates all refresh tokens and session cookies for the user.
import { workflow } from "serval/core";
import * as microsoftGraph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (args: { userPrincipalName: string }, ctx: microsoftGraph.context.MicrosoftGraphIntegration) => {
    const user = (await microsoftGraph.apiRequest(
      { path: `/v1.0/users/${encodeURIComponent(args.userPrincipalName)}?$select=id,displayName,signInSessionsValidFromDateTime` },
      ctx,
    )) as { id: string; displayName: string; signInSessionsValidFromDateTime: string };

    const result = (await microsoftGraph.apiRequest(
      { path: `/v1.0/users/${user.id}/revokeSignInSessions`, method: "POST" },
      ctx,
    )) as { value: boolean };

    return {
      user: user.displayName,
      revoked: result.value,
      previousSessionsValidFrom: user.signInSessionsValidFromDateTime,
      note: "User will be prompted to sign in again on all devices within a few minutes.",
    };
  },
});
