// @title Help a user who lost their phone sign in to Google
// @expect approval
// @note Read-only HTTP, but it returns the user's 2SV backup verification codes, which are secret material.
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

export const main = workflow({
  fn: async (args: { userEmail: string }, ctx: googleWorkspace.context.GoogleWorkspaceIntegration) => {
    const user = (await googleWorkspace.apiRequest(
      { path: `/admin/directory/v1/users/${encodeURIComponent(args.userEmail)}?fields=primaryEmail,isEnrolledIn2Sv,isEnforcedIn2Sv,suspended` },
      ctx,
    )) as { primaryEmail: string; isEnrolledIn2Sv: boolean; isEnforcedIn2Sv: boolean; suspended: boolean };

    if (!user.isEnrolledIn2Sv) {
      return { email: user.primaryEmail, enrolledIn2Sv: false, note: "User is not enrolled in 2-Step Verification." };
    }

    const codes = (await googleWorkspace.apiRequest(
      { path: `/admin/directory/v1/users/${encodeURIComponent(args.userEmail)}/verificationCodes`, method: "GET" },
      ctx,
    )) as { items?: Array<{ verificationCode: string; userId: string }> };

    return {
      email: user.primaryEmail,
      enrolledIn2Sv: true,
      enforced: user.isEnforcedIn2Sv,
      backupCodes: (codes.items ?? []).map((c) => c.verificationCode),
      instructions: "Give the user one backup code; they can sign in and re-register their new phone.",
    };
  },
});
