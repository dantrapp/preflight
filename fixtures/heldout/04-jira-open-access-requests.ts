// @title List open access-request tickets older than 3 days
// @expect read-only
// @note POST /rest/api/3/search/jql is Jira's JQL search endpoint and only reads issues.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

type SearchResult = {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      created: string;
      status: { name: string };
      assignee: { displayName: string } | null;
      reporter: { displayName: string };
    };
  }>;
  nextPageToken?: string;
};

export const main = workflow({
  fn: async (args: { projectKey: string; olderThanDays?: number }, ctx: jira.context.JiraIntegration) => {
    const age = args.olderThanDays ?? 3;
    const jql = `project = "${args.projectKey}" AND issuetype = "Access Request" AND statusCategory != Done AND created <= -${age}d ORDER BY created ASC`;

    const out: Array<{ key: string; summary: string; status: string; assignee: string; reporter: string; ageDays: number }> = [];
    let nextPageToken: string | undefined;
    do {
      const res = (await jira.apiRequest(
        {
          path: "/rest/api/3/search/jql",
          method: "POST",
          body: {
            jql,
            maxResults: 100,
            fields: ["summary", "created", "status", "assignee", "reporter"],
            ...(nextPageToken ? { nextPageToken } : {}),
          },
        },
        ctx,
      )) as SearchResult;

      for (const issue of res.issues) {
        out.push({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName ?? "Unassigned",
          reporter: issue.fields.reporter.displayName,
          ageDays: Math.floor((Date.now() - new Date(issue.fields.created).getTime()) / 86_400_000),
        });
      }
      nextPageToken = res.nextPageToken;
    } while (nextPageToken);

    return { total: out.length, tickets: out };
  },
});
