// @source https://docs.serval.com/sections/integrations/aws.md
import { workflow } from "serval/core";
import * as aws from "serval/integrations/aws";

export const main = workflow({
  fn: async (_: Record<string, never>, ctx: aws.context.AllAWSIntegrationAppInstances<"accounts">) => {
    const results = [];
    for (const account of ctx.integrations.aws.accounts) {
      const roles = await aws.iam.apiRequest({ command: "listRoles", region: "us-east-1", args: { MaxItems: 5 } }, account);
      results.push({ accountId: account.integrations.aws.accountId, roles: (roles.Roles ?? []).map((r) => r.RoleName) });
    }
    return results;
  },
});
