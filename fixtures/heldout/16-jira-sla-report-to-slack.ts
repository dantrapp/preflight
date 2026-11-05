// @title Weekly report of IT tickets that breached SLA
// @expect approval
// @note The Jira part only reads, but the workflow posts the report to a Slack channel (a message side effect).
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";
import * as slack from "serval/integrations/slack";

export const main = workflow({
  fn: async (
    args: { projectKey: string; channel?: string },
    ctx: jira.context.JiraIntegration & slack.context.SlackIntegration,
  ) => {
    const jql = `project = "${args.projectKey}" AND "Time to resolution" = breached() AND resolved >= -7d ORDER BY priority DESC`;
    const res = (await jira.apiRequest(
      {
        path: "/rest/api/3/search/jql",
        method: "POST",
        body: { jql, maxResults: 100, fields: ["summary", "priority", "assignee"] },
      },
      ctx,
    )) as { issues: Array<{ key: string; fields: { summary: string; priority: { name: string }; assignee: { displayName: string } | null } }> };

    const lines = res.issues.map(
      (i) => `• <https://yourcompany.atlassian.net/browse/${i.key}|${i.key}> [${i.fields.priority.name}] ${i.fields.summary} — ${i.fields.assignee?.displayName ?? "unassigned"}`,
    );

    const text =
      res.issues.length === 0
        ? `:white_check_mark: No SLA breaches in ${args.projectKey} this week.`
        : `:rotating_light: *${res.issues.length} SLA breaches in ${args.projectKey} (last 7 days)*\n${lines.join("\n")}`;

    await slack.chat.postMessage({ channel: args.channel ?? "#it-ops", text, unfurl_links: false }, ctx);

    return { breaches: res.issues.length, keys: res.issues.map((i) => i.key) };
  },
});
