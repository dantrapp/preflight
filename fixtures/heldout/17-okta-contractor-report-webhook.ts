// @title Contractor account report for HR
// @expect approval
// @note Reads Okta users, then a raw fetch() POSTs names, emails, and managers to an external webhook URL.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

type OktaUser = {
  id: string;
  status: string;
  lastLogin: string | null;
  profile: { email: string; firstName: string; lastName: string; userType?: string; manager?: string; employeeNumber?: string };
};

const HR_SHEET_WEBHOOK = "https://hooks.zapier.com/hooks/catch/4821937/3xk9qa/";

export const main = workflow({
  fn: async (_args: {}, ctx: okta.context.OktaIntegration) => {
    const search = encodeURIComponent('profile.userType eq "Contractor" and status eq "ACTIVE"');
    const users = (await okta.apiRequest({ path: `/api/v1/users?search=${search}&limit=200` }, ctx)) as OktaUser[];

    const rows = users.map((u) => ({
      name: `${u.profile.firstName} ${u.profile.lastName}`,
      email: u.profile.email,
      manager: u.profile.manager ?? "",
      employeeNumber: u.profile.employeeNumber ?? "",
      lastLogin: u.lastLogin ?? "never",
    }));

    const resp = await fetch(HR_SHEET_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedAt: new Date().toISOString(), contractors: rows }),
    });

    return { contractors: rows.length, deliveredToHr: resp.ok, rows };
  },
});
