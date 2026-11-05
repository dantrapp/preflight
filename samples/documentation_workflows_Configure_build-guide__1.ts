// @source https://docs.serval.com/sections/documentation/workflows/Configure/build-guide.md
await twilio.common.sendWhatsAppMessage({
  fromPhoneNumber: "+15551234567",
  toPhoneNumber: employeePhoneNumber,
  contentSid: "HX0123456789abcdef0123456789abcdef",
  variables: {
    "1": employeeName,
    "2": `https://app.serval.com/journeys/${journeyId}?org=${organizationSlug}`,
  },
}, ctx);
