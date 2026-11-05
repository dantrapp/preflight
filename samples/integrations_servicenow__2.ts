// @source https://docs.serval.com/sections/integrations/servicenow.md
const route = {
  user: { userId: userSysId, email: args.email },
  message: args.userMessage,
  channelId: "chat",
  contextVariables: {
    requested_skill: args.requestedSkill,
    requester_country: args.requesterCountry,
  },
};

const availability = await servicenow.checkLiveAgentRouteAvailability(
  {
    endpointPath: "/api/<namespace>/live_agent/route_availability",
    ...route,
  },
  ctx,
);

if (!availability.agentsAvailable) {
  return {
    available: false,
    reason: availability.reason ?? "No matching live agents are available.",
    queueDepth: availability.queueDepth,
  };
}

await servicenow.startLiveAgentSession(
  { ticketId: args.ticketId, ...route },
  ctx,
);
