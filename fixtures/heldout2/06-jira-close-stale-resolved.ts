// @title Close out IT tickets that have been sitting in Resolved for over two weeks
// @expect approval
// @note Searches with JQL, then transitions each matching issue to Closed.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

export const main = workflow({
  fn: async (
    args: { projectKey: string; days?: number; dryRun?: boolean },
    ctx: jira.context.JiraIntegration,
  ) => {
    const days = args.days ?? 14;
    const jql = `project = ${args.projectKey} AND status = Resolved AND updated <= -${days}d ORDER BY updated ASC`;

    const issues: any[] = [];
    let nextPageToken: string | undefined = undefined;
    do {
      const page: any = await jira.apiRequest(
        {
          path: "/rest/api/3/search/jql",
          method: "POST",
          body: {
            jql,
            fields: ["summary", "status", "updated", "assignee"],
            maxResults: 100,
            ...(nextPageToken ? { nextPageToken } : {}),
          },
        },
        ctx,
      );
      issues.push(...(page.issues ?? []));
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    if (args.dryRun) {
      return { wouldClose: issues.map((i) => i.key), count: issues.length };
    }

    const closed: string[] = [];
    const skipped: { key: string; reason: string }[] = [];

    for (const issue of issues) {
      const t: any = await jira.apiRequest(
        { path: `/rest/api/3/issue/${issue.key}/transitions` },
        ctx,
      );
      const closeTransition = (t.transitions ?? []).find(
        (tr: any) => tr.name.toLowerCase() === "close" || tr.to?.name === "Closed",
      );
      if (!closeTransition) {
        skipped.push({ key: issue.key, reason: "no Close transition available" });
        continue;
      }
      await jira.apiRequest(
        {
          path: `/rest/api/3/issue/${issue.key}/transitions`,
          method: "POST",
          body: { transition: { id: closeTransition.id } },
        },
        ctx,
      );
      closed.push(issue.key);
    }

    return { closed, skipped, total: issues.length };
  },
});
