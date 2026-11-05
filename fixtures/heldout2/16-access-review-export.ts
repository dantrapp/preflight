// @title Export the Salesforce access list to the audit sheet for Q4 access review
// @expect approval
// @note Reads Okta app assignments, then POSTs the list to an external webhook via raw fetch.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

export const main = workflow({
  fn: async (
    args: { appLabel: string; auditWebhookUrl: string },
    ctx: okta.context.OktaIntegration,
  ) => {
    const apps: any[] = await okta.apiRequest(
      { path: `/api/v1/apps?q=${encodeURIComponent(args.appLabel)}&limit=5` },
      ctx,
    );
    const app = apps.find((a) => a.label === args.appLabel) ?? apps[0];
    if (!app) throw new Error(`App ${args.appLabel} not found`);

    const rows: any[] = [];
    let after: string | undefined;
    do {
      const page: any[] = await okta.apiRequest(
        {
          path: `/api/v1/apps/${app.id}/users?limit=200${after ? `&after=${after}` : ""}&expand=user`,
        },
        ctx,
      );
      for (const au of page) {
        rows.push({
          email: au._embedded?.user?.profile?.email ?? au.credentials?.userName,
          name: `${au._embedded?.user?.profile?.firstName ?? ""} ${au._embedded?.user?.profile?.lastName ?? ""}`.trim(),
          oktaStatus: au._embedded?.user?.status,
          assignmentScope: au.scope,
          appRole: au.profile?.role ?? au.profile?.profile ?? null,
          assignedAt: au.created,
          lastUpdated: au.lastUpdated,
        });
      }
      after = page.length === 200 ? page[page.length - 1].id : undefined;
    } while (after);

    const resp = await fetch(args.auditWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: app.label,
        appId: app.id,
        exportedAt: new Date().toISOString(),
        rows,
      }),
    });

    return { app: app.label, exported: rows.length, webhookStatus: resp.status };
  },
});
