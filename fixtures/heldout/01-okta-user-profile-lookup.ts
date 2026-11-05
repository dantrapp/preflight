// @title Look up an Okta user's profile, groups, and admin roles
// @expect read-only
// @note Only GET calls against Okta users, groups, and roles; returns a summary with no secrets.
import { workflow } from "serval/core";
import * as okta from "serval/integrations/okta";

interface OktaUser {
  id: string;
  status: string;
  created: string;
  lastLogin: string | null;
  profile: { login: string; email: string; firstName: string; lastName: string; department?: string };
}

export const main = workflow({
  fn: async (args: { login: string }, ctx: okta.context.OktaIntegration) => {
    const user = (await okta.apiRequest(
      { path: `/api/v1/users/${encodeURIComponent(args.login)}` },
      ctx,
    )) as OktaUser;

    const groups = (await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/groups`, method: "GET" },
      ctx,
    )) as Array<{ id: string; profile: { name: string } }>;

    const roles = (await okta.apiRequest(
      { path: `/api/v1/users/${user.id}/roles`, method: "GET" },
      ctx,
    )) as Array<{ id: string; type: string; label: string; status: string }>;

    return {
      id: user.id,
      login: user.profile.login,
      name: `${user.profile.firstName} ${user.profile.lastName}`,
      department: user.profile.department ?? null,
      status: user.status,
      lastLogin: user.lastLogin,
      groups: groups.map((g) => g.profile.name),
      adminRoles: roles.map((r) => r.label || r.type),
    };
  },
});
