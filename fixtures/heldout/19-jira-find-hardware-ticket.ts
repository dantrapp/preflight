// @title Look up the hardware request ticket for a new hire
// @expect approval
// @note If no matching ticket is found, the else-branch creates a new Jira issue.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

async function findTicket(newHireEmail: string, ctx: jira.context.JiraIntegration) {
  const res = (await jira.apiRequest(
    {
      path: "/rest/api/3/search/jql",
      method: "POST",
      body: {
        jql: `project = HW AND text ~ "${newHireEmail}" ORDER BY created DESC`,
        maxResults: 1,
        fields: ["summary", "status", "assignee", "created"],
      },
    },
    ctx,
  )) as { issues: Array<{ key: string; fields: { summary: string; status: { name: string }; assignee: { displayName: string } | null; created: string } }> };
  return res.issues[0];
}

export const main = workflow({
  fn: async (
    args: { newHireEmail: string; startDate: string; laptop?: string },
    ctx: jira.context.JiraIntegration,
  ) => {
    const existing = await findTicket(args.newHireEmail, ctx);
    if (existing) {
      return {
        found: true,
        key: existing.key,
        summary: existing.fields.summary,
        status: existing.fields.status.name,
        assignee: existing.fields.assignee?.displayName ?? "Unassigned",
      };
    } else {
      // Nothing on file yet, so open one so the new hire isn't missed
      const created = (await jira.apiRequest(
        {
          path: "/rest/api/3/issue",
          method: "POST",
          body: {
            fields: {
              project: { key: "HW" },
              issuetype: { name: "Task" },
              summary: `Hardware for new hire ${args.newHireEmail} (start ${args.startDate})`,
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: `Requested device: ${args.laptop ?? "Standard MacBook Pro 14\""}` }],
                  },
                ],
              },
              labels: ["new-hire", "auto-created"],
            },
          },
        },
        ctx,
      )) as { id: string; key: string };
      return { found: false, createdKey: created.key };
    }
  },
});
