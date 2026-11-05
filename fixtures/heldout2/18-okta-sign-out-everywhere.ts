// @title My phone got stolen, can you sign me out of everything?
// @expect approval
// @note Revokes all Okta sessions and OAuth tokens for the user, a state change.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (args: { userId: string }, ctx: okta.context.OktaIntegration) => {
    const user: any = await okta.apiRequest(
      { path: `/api/v1/users/${args.userId}` },
      ctx,
    );

    const factors: any[] = await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/factors` },
      ctx,
    );

    await okta.apiRequest(
      {
        path: `/api/v1/users/${user.id}/sessions?oauthTokens=true`,
        method: "DELETE",
      },
      ctx,
    );

    return {
      user: user.profile?.login,
      sessionsCleared: true,
      oauthTokensRevoked: true,
      enrolledFactors: factors.map((f) => ({
        id: f.id,
        type: f.factorType,
        provider: f.provider,
        device: f.profile?.name ?? f.profile?.deviceType ?? null,
      })),
      nextStep:
        "Consider removing the push/TOTP factor tied to the stolen phone once the user confirms.",
    };
  },
});
