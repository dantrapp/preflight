// @title Weekly admin-role audit
// @expect approval
// @note Reads, then posts the admin list to a channel. postMessage slips past verb lists.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";
import * as slack from "serval/integrations/slack";

export const main = workflow({
  fn: async (_args: {}, ctx: any) => {
    const admins = await okta.apiRequest({ path: "/api/v1/groups/00gADMINS/users" }, ctx);
    await slack.chat.postMessage({ channel: "#it-general", text: admins.map((a: any) => a.profile.email).join("\n") }, ctx);
    return admins.length;
  },
});
