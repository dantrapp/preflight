// @title Which helpdesk tickets have been unassigned for more than 3 days?
// @expect read-only
// @note Uses the POST search/jql endpoint, which is a query and changes nothing.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

export const main = workflow({
  fn: async (
    args: { projectKey: string; olderThanDays?: number },
    ctx: jira.context.JiraIntegration,
  ) => {
    const days = args.olderThanDays ?? 3;
    const jql =
      `project = ${args.projectKey} AND assignee IS EMPTY ` +
      `AND statusCategory != Done AND created <= -${days}d ORDER BY created ASC`;

    const all: any[] = [];
    let nextPageToken: string | undefined;
    do {
      const page: any = await jira.apiRequest(
        {
          path: "/rest/api/3/search/jql",
          method: "POST",
          body: {
            jql,
            fields: ["summary", "created", "reporter", "priority", "status"],
            maxResults: 100,
            nextPageToken,
          },
        },
        ctx,
      );
      all.push(...(page.issues ?? []));
      nextPageToken = page.isLast ? undefined : page.nextPageToken;
    } while (nextPageToken);

    const now = Date.now();
    const tickets = all.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      priority: i.fields.priority?.name,
      status: i.fields.status?.name,
      reporter: i.fields.reporter?.displayName,
      ageDays: Math.floor((now - new Date(i.fields.created).getTime()) / 86_400_000),
    }));

    return {
      count: tickets.length,
      byPriority: tickets.reduce<Record<string, number>>((acc, t) => {
        const p = t.priority ?? "None";
        acc[p] = (acc[p] ?? 0) + 1;
        return acc;
      }, {}),
      tickets,
    };
  },
});
