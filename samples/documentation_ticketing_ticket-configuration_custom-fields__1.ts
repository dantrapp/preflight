// @source https://docs.serval.com/sections/documentation/ticketing/ticket-configuration/custom-fields.md
const options = await serval.common.listCustomFieldOptions({
  teamId: ctx.currentTeam.id,
});
