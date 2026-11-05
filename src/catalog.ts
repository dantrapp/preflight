export type Effect = "read" | "write" | "destructive" | "notify" | "unknown";

export interface Rule {
  method: string;
  path: RegExp;
  effect: Effect;
  label: string;
  scope?: string;
  reversible?: boolean;
}

type Row = [method: string, path: string, effect: Effect, label: string, scope?: string, reversible?: boolean];

function pattern(path: string): RegExp {
  const body = path
    .replace(/[.*+?^$()|[\]\\]/g, "\\$&")
    .replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${body}(?:\\?.*)?$`);
}

function rules(rows: Row[]): Rule[] {
  return rows.map(([method, path, effect, label, scope, reversible]) => ({
    method, path: pattern(path), effect, label, scope, reversible,
  }));
}

// HTTP verb is not the effect. Each row is labeled from the vendor's reference docs.
export const RULES: Record<string, Rule[]> = {
  okta: rules([
    ["GET", "/api/v1/users", "read", "list users", "okta.users.read"],
    ["GET", "/api/v1/users/{id}", "read", "get user", "okta.users.read"],
    ["GET", "/api/v1/users/{id}/groups", "read", "list user groups", "okta.users.read"],
    ["GET", "/api/v1/users/{id}/factors", "read", "list MFA factors", "okta.users.read"],
    ["GET", "/api/v1/users/{id}/roles", "read", "list admin roles", "okta.roles.read"],
    ["POST", "/api/v1/users/{id}/lifecycle/suspend", "destructive", "suspend user", "okta.users.manage", true],
    ["POST", "/api/v1/users/{id}/lifecycle/deactivate", "destructive", "deactivate user", "okta.users.manage", false],
    ["POST", "/api/v1/users/{id}/lifecycle/reset_factors", "destructive", "reset all MFA factors", "okta.users.manage", false],
    ["POST", "/api/v1/users/{id}/lifecycle/expire_password", "destructive", "expire password", "okta.users.manage", false],
    ["POST", "/api/v1/users/{id}/lifecycle/unlock", "write", "unlock user", "okta.users.manage"],
    ["DELETE", "/api/v1/users/{id}/sessions", "destructive", "revoke all sessions", "okta.users.manage", false],
    ["DELETE", "/api/v1/users/{id}", "destructive", "delete user", "okta.users.manage", false],
    ["POST", "/api/v1/users/{id}", "write", "update user profile", "okta.users.manage"],
    ["GET", "/api/v1/groups", "read", "list groups", "okta.groups.read"],
    ["GET", "/api/v1/groups/{id}/users", "read", "list group members", "okta.groups.read"],
    ["PUT", "/api/v1/groups/{id}/users/{uid}", "write", "add user to group", "okta.groups.manage", true],
    ["DELETE", "/api/v1/groups/{id}/users/{uid}", "write", "remove user from group", "okta.groups.manage", true],
    ["GET", "/api/v1/apps", "read", "list apps", "okta.apps.read"],
    ["DELETE", "/api/v1/apps/{id}/users/{uid}", "write", "unassign app", "okta.apps.manage", true],
    ["GET", "/api/v1/logs", "read", "read system log", "okta.logs.read"],
  ]),
  "google-workspace": rules([
    ["GET", "/admin/directory/v1/users", "read", "list users", "admin.directory.user.readonly"],
    ["GET", "/admin/directory/v1/users/{id}", "read", "get user", "admin.directory.user.readonly"],
    ["PUT", "/admin/directory/v1/users/{id}", "write", "update user", "admin.directory.user"],
    ["POST", "/admin/directory/v1/users/{id}/makeAdmin", "destructive", "grant super admin", "admin.directory.user", true],
    ["POST", "/admin/directory/v1/users/{id}/signOut", "destructive", "sign out all sessions", "admin.directory.user.security", false],
    ["DELETE", "/admin/directory/v1/users/{id}", "destructive", "delete user", "admin.directory.user", false],
    ["GET", "/admin/directory/v1/groups", "read", "list groups", "admin.directory.group.readonly"],
    ["GET", "/admin/directory/v1/groups/{id}/members", "read", "list members", "admin.directory.group.member.readonly"],
    ["POST", "/admin/directory/v1/groups/{id}/members", "write", "add member", "admin.directory.group.member", true],
    ["DELETE", "/admin/directory/v1/groups/{id}/members/{mid}", "write", "remove member", "admin.directory.group.member", true],
    ["POST", "/admin/directory/v1/users/{id}/verificationCodes/generate", "destructive", "regenerate backup codes", "admin.directory.user.security", false],
    ["GET", "/admin/directory/v1/users/{id}/verificationCodes", "read", "list backup codes", "admin.directory.user.security"],
    ["GET", "/drive/v3/files", "read", "search Drive files", "drive.readonly"],
    ["GET", "/drive/v3/files/{id}/permissions", "read", "list file permissions", "drive.readonly"],
    ["POST", "/drive/v3/files/{id}/permissions", "write", "share Drive file", "drive", true],
  ]),
  "microsoft-graph": rules([
    ["GET", "/v1.0/users", "read", "list users", "User.Read.All"],
    ["GET", "/v1.0/users/{id}", "read", "get user", "User.Read.All"],
    ["GET", "/v1.0/users/{id}/manager", "read", "get manager", "User.Read.All"],
    ["GET", "/v1.0/users/{id}/memberOf", "read", "list memberships", "GroupMember.Read.All"],
    ["GET", "/v1.0/users/{id}/ownedDevices", "read", "list owned devices", "Device.Read.All"],
    ["POST", "/v1.0/users/{id}/getMemberGroups", "read", "get member groups", "GroupMember.Read.All"],
    ["POST", "/v1.0/users/{id}/checkMemberGroups", "read", "check member groups", "GroupMember.Read.All"],
    ["POST", "/v1.0/directoryObjects/getByIds", "read", "resolve directory objects", "Directory.Read.All"],
    ["POST", "/v1.0/users/{id}/revokeSignInSessions", "destructive", "revoke sign-in sessions", "User.RevokeSessions.All", false],
    ["PATCH", "/v1.0/users/{id}", "write", "update user", "User.ReadWrite.All"],
    ["DELETE", "/v1.0/users/{id}", "destructive", "delete user", "User.ReadWrite.All", false],
    ["GET", "/v1.0/groups/{id}/members", "read", "list members", "GroupMember.Read.All"],
    ["POST", "/v1.0/groups/{id}/members/$ref", "write", "add member", "GroupMember.ReadWrite.All", true],
    ["DELETE", "/v1.0/groups/{id}/members/{mid}/$ref", "write", "remove member", "GroupMember.ReadWrite.All", true],
    ["GET", "/v1.0/auditLogs/signIns", "read", "read sign-in logs", "AuditLog.Read.All"],
  ]),
  jira: rules([
    ["POST", "/rest/api/3/search/jql", "read", "JQL search", "read:jira-work"],
    ["GET", "/rest/api/3/issue/{id}", "read", "get issue", "read:jira-work"],
    ["POST", "/rest/api/3/issue", "write", "create issue", "write:jira-work"],
    ["POST", "/rest/api/3/issue/{id}/comment", "write", "comment on issue", "write:jira-work"],
  ]),
  sonos: rules([
    ["GET", "/control/api/v1/households", "read", "list households"],
    ["GET", "/control/api/v1/households/{id}/groups", "read", "list groups"],
    ["GET", "/control/api/v1/households/{id}/favorites", "read", "list favorites"],
  ]),
  slack: rules([
    ["*", "conversations.list", "read", "list channels", "channels:read"],
    ["*", "conversations.info", "read", "channel info", "channels:read"],
    ["*", "users.lookupByEmail", "read", "look up user", "users:read.email"],
    ["*", "chat.postMessage", "notify", "post message", "chat:write"],
    ["*", "admin.users.session.reset", "destructive", "reset Slack sessions", "admin.users:write", false],
  ]),
};

export const HELPERS: Record<string, Record<string, Omit<Rule, "method" | "path">>> = {
  sonos: { playFavorite: { effect: "write", label: "regroup rooms and play" } },
  twilio: { "common.sendWhatsAppMessage": { effect: "notify", label: "send WhatsApp message" } },
  okta: {
    "users.list": { effect: "read", label: "list users", scope: "okta.users.read" },
    "users.suspend": { effect: "destructive", label: "suspend user", scope: "okta.users.manage", reversible: true },
    "users.resetMfa": { effect: "destructive", label: "reset MFA", scope: "okta.users.manage", reversible: false },
    "groups.removeMember": { effect: "write", label: "remove member", scope: "okta.groups.manage", reversible: true },
  },
  slack: { "chat.postMessage": { effect: "notify", label: "post message", scope: "chat:write" } },
};

export const SEVERITY: Record<Effect, number> = { read: 0, notify: 1, write: 2, unknown: 3, destructive: 4 };

export function classify(integration: string, method: string, path: string): Rule | undefined {
  const m = method.toUpperCase();
  return RULES[integration]?.find((r) => (r.method === "*" || r.method === m) && r.path.test(path));
}
