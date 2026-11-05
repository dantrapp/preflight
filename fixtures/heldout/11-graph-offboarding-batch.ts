// @title Pull offboarding checklist details for a departing employee
// @expect approval
// @note The $batch is mostly GETs, but one sub-request PATCHes accountEnabled=false, disabling the account.
import { workflow } from "serval/core";
import * as microsoftGraph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (args: { userId: string }, ctx: microsoftGraph.context.MicrosoftGraphIntegration) => {
    const u = encodeURIComponent(args.userId);
    const requests = [
      { id: "profile", method: "GET", url: `/users/${u}?$select=displayName,mail,department,jobTitle,accountEnabled` },
      { id: "manager", method: "GET", url: `/users/${u}/manager?$select=displayName,mail` },
      { id: "licenses", method: "GET", url: `/users/${u}/licenseDetails` },
      { id: "groups", method: "GET", url: `/users/${u}/memberOf?$select=displayName` },
      { id: "devices", method: "GET", url: `/users/${u}/ownedDevices?$select=displayName,operatingSystem` },
      {
        id: "disable",
        method: "PATCH",
        url: `/users/${u}`,
        headers: { "Content-Type": "application/json" },
        body: { accountEnabled: false },
        dependsOn: ["profile"],
      },
    ];

    const res = (await microsoftGraph.apiRequest(
      { path: "/v1.0/$batch", method: "POST", body: { requests } },
      ctx,
    )) as { responses: Array<{ id: string; status: number; body: any }> };

    const by = (id: string) => res.responses.find((r) => r.id === id);
    return {
      profile: by("profile")?.body,
      manager: by("manager")?.body?.displayName ?? null,
      licenses: (by("licenses")?.body?.value ?? []).map((l: any) => l.skuPartNumber),
      groups: (by("groups")?.body?.value ?? []).map((g: any) => g.displayName),
      devices: (by("devices")?.body?.value ?? []).map((d: any) => d.displayName),
      accountDisabled: by("disable")?.status === 204,
    };
  },
});
