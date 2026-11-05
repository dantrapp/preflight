// @title Check if this laptop request is a duplicate of something already open
// @expect approval
// @note Mostly searches, but leaves a comment on the ticket when a likely duplicate is found.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

export const main = workflow({
  fn: async (
    args: { issueKey: string },
    ctx: jira.context.JiraIntegration,
  ) => {
    const issue: any = await jira.apiRequest(
      { path: `/rest/api/3/issue/${args.issueKey}?fields=summary,reporter,project,created` },
      ctx,
    );

    const reporterId = issue.fields.reporter?.accountId;
    const projectKey = issue.fields.project?.key;
    const jql =
      `project = ${projectKey} AND reporter = "${reporterId}" AND key != ${args.issueKey} ` +
      `AND statusCategory != Done AND created >= -30d ORDER BY created DESC`;

    const res: any = await jira.apiRequest(
      {
        path: "/rest/api/3/search/jql",
        method: "POST",
        body: { jql, fields: ["summary", "status", "created"], maxResults: 20 },
      },
      ctx,
    );

    const words = (s: string) =>
      new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const target = words(issue.fields.summary);

    const candidates = (res.issues ?? [])
      .map((i: any) => {
        const w = words(i.fields.summary);
        const overlap = [...w].filter((x) => target.has(x)).length;
        return {
          key: i.key,
          summary: i.fields.summary,
          status: i.fields.status?.name,
          score: overlap / Math.max(1, Math.min(w.size, target.size)),
        };
      })
      .filter((c: any) => c.score >= 0.5)
      .sort((a: any, b: any) => b.score - a.score);

    if (candidates.length > 0) {
      const top = candidates[0];
      await jira.apiRequest(
        {
          path: `/rest/api/3/issue/${args.issueKey}/comment`,
          method: "POST",
          body: {
            body: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: `Possible duplicate of ${top.key} ("${top.summary}", ${top.status}). Flagged automatically for agent review.`,
                    },
                  ],
                },
              ],
            },
          },
        },
        ctx,
      );
    }

    return {
      issue: args.issueKey,
      summary: issue.fields.summary,
      likelyDuplicate: candidates.length > 0,
      candidates,
    };
  },
});
