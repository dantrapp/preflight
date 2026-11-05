// @source https://docs.serval.com/sections/integrations/adobe.md
import { workflow } from "serval/core";
import * as adobe from "serval/integrations/adobe";

export const main = workflow({
  fn: async (_args: {}, ctx: adobe.context.AdobeIntegration) => {
    const { orgId } = ctx.integrations.adobe;

    // List the first page of users in the organization.
    return await adobe.apiRequest(
      {
        path: `/v2/usermanagement/users/${encodeURIComponent(orgId)}/0`,
        method: "GET",
      },
      ctx,
    );
  },
});
