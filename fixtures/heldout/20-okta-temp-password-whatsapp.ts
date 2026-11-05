// @title Get a locked-out remote employee back into their account
// @expect approval
// @note Expires the password with a temp password (write + secret) and sends it to the user over WhatsApp.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";
import * as twilio from "serval/integrations/twilio";

export const main = workflow({
  fn: async (
    args: { login: string },
    ctx: okta.context.OktaIntegration & twilio.context.TwilioIntegration,
  ) => {
    const user = (await okta.apiRequest({ path: `/api/v1/users/${encodeURIComponent(args.login)}` }, ctx)) as {
      id: string;
      status: string;
      profile: { firstName: string; mobilePhone?: string };
    };

    if (!user.profile.mobilePhone) {
      return { ok: false, reason: "No mobile phone on file; escalate to a human." };
    }

    if (user.status === "LOCKED_OUT") {
      await okta.apiRequest({ path: `/api/v1/users/${user.id}/lifecycle/unlock`, method: "POST" }, ctx);
    }

    const temp = (await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/lifecycle/expire_password?tempPassword=true`, method: "POST" },
      ctx,
    )) as { tempPassword: string };

    await twilio.common.sendWhatsAppMessage(
      {
        to: `whatsapp:${user.profile.mobilePhone}`,
        body: `Hi ${user.profile.firstName}, your temporary Okta password is ${temp.tempPassword}. You'll be asked to set a new one when you sign in.`,
      },
      ctx,
    );

    return { ok: true, message: `Temporary password sent via WhatsApp to ${user.profile.mobilePhone}` };
  },
});
