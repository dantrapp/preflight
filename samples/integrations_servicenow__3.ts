// @source https://docs.serval.com/sections/integrations/servicenow.md
import { workflow, sleep } from "serval/core";
import * as servicenow from "serval/integrations/servicenow";

export const main = workflow({
  fn: async function (
    args: {
      email: string;       // The end-user's email
      userMessage: string; // The user's natural-language message
      ticketId: string;    // The Serval ticket to bridge onto
    },
    ctx: servicenow.context.ServiceNowIntegration,
  ) {
    // 1) Resolve the ServiceNow sys_user.sys_id for this user. The
    //    Bot-to-Bot endpoint accepts email/username but account-linking
    //    works best with a sys_id, and AWA assignment is more reliable.
    const userSysId = await servicenow.lookupUserSysIdByEmail(
      { email: args.email },
      ctx,
    );

    // 2) Compose the message text. The trailing trigger phrase is what
    //    ServiceNow's NLU classifies as the "Live Agent Support" topic -
    //    the OOB topic that drives the AWA handoff without going through
    //    the Greetings picker. Customers who have renamed that topic
    //    or have a custom topic should adapt the phrase to match.
    const ROUTING_TRIGGER_PHRASE =
      "I need a live agent. Please connect me with Live Agent Support - I want to talk to an agent.";
    const message =
      args.userMessage && args.userMessage.length > 0
        ? args.userMessage + "\n\n" + ROUTING_TRIGGER_PHRASE
        : ROUTING_TRIGGER_PHRASE;

    // 3) Open the conversation. `connectTicket: true` (default) wires
    //    the ServiceNow clientSessionId onto the Serval ticket as an
    //    interaction-subtype external ticket, so subsequent user
    //    replies on the Serval ticket auto-egress as AGENT_CHAT turns.
    const { clientSessionId, liveAgentData } =
      await servicenow.startLiveAgentSession(
        {
          ticketId: args.ticketId,
          user: { userId: userSysId, email: args.email },
          message,
          channelId: "chat",
          contextVariables: { u_liveagent_optional_skills: "IT" },
        },
        ctx,
      );

    // 4) Optional: poll the `interaction` table to learn which agent
    //    actually picked up the conversation. START returns only an
    //    async ack - the real assignment happens a moment later when
    //    AWA matches an available agent. Stop early once `assigned_to`
    //    is populated.
    let routingInteraction: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep({ durationMs: 3000 });
      const { result } = await servicenow.tableApiRequest(
        {
          method: "GET",
          path: "/api/now/table/{tableName}",
          pathParams: { tableName: "interaction" },
          query: {
            sysparm_query:
              "opened_for=" + userSysId + "^type=chat^ORDERBYDESCsys_created_on",
            sysparm_fields:
              "sys_id,number,state,assigned_to,assignment_group,queue,opened_at",
            sysparm_display_value: "true",
            sysparm_exclude_reference_link: "true",
            sysparm_limit: "1",
          },
        },
        ctx,
      ) as { result: Array<Record<string, unknown>> };

      if (result.length > 0) {
        routingInteraction = result[0];
        if (routingInteraction["assigned_to"]) {
          break; // Agent picked up - done polling.
        }
      }
    }

    // 5) Stash the polled `interaction.sys_id` onto the Serval external
    //    ticket. This enables the Agent Workspace deep link and the
    //    record-upload fallback for Word and Excel files. It can be
    //    omitted only if those capabilities are not needed.
    if (routingInteraction && typeof routingInteraction["sys_id"] === "string") {
      await servicenow.attachInteractionSysIdToLiveAgentSession(
        {
          ticketId: args.ticketId,
          clientSessionId,
          liveAgentData,
          interactionSysId: routingInteraction["sys_id"],
        },
        ctx,
      );
    }

    return {
      clientSessionId,
      assignedAgent: routingInteraction?.["assigned_to"] ?? null,
      assignmentGroup: routingInteraction?.["assignment_group"] ?? null,
    };
  },
});
