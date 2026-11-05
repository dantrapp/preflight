// @title Count open IT tickets by assignee
// @expect read-only
// @note POST, but JQL search is a read. Verb heuristics force a needless approval.
import { workflow } from "serval/core";
import * as jira from "serval/integrations/jira";

export const main = workflow({
  fn: async (_args: {}, ctx: jira.context.JiraIntegration) => {
    const res = await jira.apiRequest({ path: "/rest/api/3/search/jql", method: "POST", body: { jql: "project = IT AND statusCategory != Done", maxResults: 500 } }, ctx);
    const counts: Record<string, number> = {};
    for (const i of res.issues) counts[i.fields.assignee?.displayName ?? "unassigned"] = (counts[i.fields.assignee?.displayName ?? "unassigned"] ?? 0) + 1;
    return counts;
  },
});
