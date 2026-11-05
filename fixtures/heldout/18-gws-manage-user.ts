// @title Manage a Google Workspace user account
// @expect approval
// @note The HTTP method and path are chosen at runtime from args.operation, which includes suspend, sign-out, and delete.
import { workflow } from "serval/core";
import * as googleWorkspace from "serval/integrations/google-workspace";

type Operation = "get" | "suspend" | "unsuspend" | "signOut" | "delete";

const OPERATIONS: Record<Operation, (userKey: string) => { path: string; method: string; body?: unknown }> = {
  get: (k) => ({ path: `/admin/directory/v1/users/${k}`, method: "GET" }),
  suspend: (k) => ({ path: `/admin/directory/v1/users/${k}`, method: "PUT", body: { suspended: true } }),
  unsuspend: (k) => ({ path: `/admin/directory/v1/users/${k}`, method: "PUT", body: { suspended: false } }),
  signOut: (k) => ({ path: `/admin/directory/v1/users/${k}/signOut`, method: "POST" }),
  delete: (k) => ({ path: `/admin/directory/v1/users/${k}`, method: "DELETE" }),
};

export const main = workflow({
  fn: async (
    args: { userEmail: string; operation: Operation },
    ctx: googleWorkspace.context.GoogleWorkspaceIntegration,
  ) => {
    const build = OPERATIONS[args.operation];
    if (!build) throw new Error(`Unsupported operation: ${args.operation}`);

    const req = build(encodeURIComponent(args.userEmail));
    const result = await googleWorkspace.apiRequest(req, ctx);

    return { operation: args.operation, user: args.userEmail, result: result ?? null };
  },
});
