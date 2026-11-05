// @source https://docs.serval.com/sections/integrations/exchange-online.md
import { workflow } from "serval/core";
import * as exchange from "serval/integrations/microsoft/powershell/exchange-online";

export const main = workflow({
  name: "Inspect mailbox and distribution group",
  fn: async (
    input: { mailboxIdentity: string; distributionGroupIdentity: string },
    ctx: exchange.context.ExchangeOnlineIntegrationFromServiceInstanceID<
      "mailboxes",
      "saved-mailbox-connection-key"
&
      exchange.context.ExchangeOnlineIntegrationFromServiceInstanceID<
        "groups",
        "saved-group-connection-key"
,
  ) => {
    const mailbox = await exchange.getMailbox(
      { identity: input.mailboxIdentity },
      ctx.integrations["exchange-online"].mailboxes,
    );
    const group = await exchange.getDistributionGroup(
      { identity: input.distributionGroupIdentity },
      ctx.integrations["exchange-online"].groups,
    );
    return { mailbox, group };
  },
});
