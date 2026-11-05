// @title Text the on-call engineer on WhatsApp if there are any open P1 tickets
// @expect approval
// @note Searches Jira for P1s, then sends a WhatsApp message via Twilio.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";
import * as twilio from "serval/integrations/twilio";

export const main = workflow({
  fn: async (
    args: { onCallPhone: string; projectKey: string },
    ctx: jira.context.JiraIntegration & twilio.context.TwilioIntegration,
  ) => {
    const jql = `project = ${args.projectKey} AND priority = Highest AND statusCategory != Done ORDER BY created DESC`;
    const res: any = await jira.apiRequest(
      {
        path: "/rest/api/3/search/jql",
        method: "POST",
        body: { jql, fields: ["summary", "created", "assignee"], maxResults: 10 },
      },
      ctx,
    );

    const issues = res.issues ?? [];
    if (issues.length === 0) {
      return { paged: false, openP1s: 0 };
    }

    const summary = issues
      .slice(0, 5)
      .map((i: any) => `${i.key}: ${i.fields.summary}`)
      .join("\n");

    const message = `IT on-call alert: ${issues.length} open P1 ticket(s) in ${args.projectKey}.\n${summary}`;

    const sent: any = await twilio.common.sendWhatsAppMessage(
      { to: args.onCallPhone, body: message },
      ctx,
    );

    return { paged: true, openP1s: issues.length, messageSid: sent?.sid };
  },
});
