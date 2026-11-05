// @title When are the three IT leads all free tomorrow afternoon?
// @expect read-only
// @note getSchedule is a POST but only reads free/busy; nothing is booked.
import { workflow } from "serval/core";
import * as graph from "serval/integrations/microsoft-graph";

export const main = workflow({
  fn: async (
    args: {
      organizer: string;
      attendees: string[];
      startIso: string;
      endIso: string;
      timeZone?: string;
    },
    ctx: graph.context.MicrosoftGraphIntegration,
  ) => {
    const timeZone = args.timeZone ?? "Pacific Standard Time";
    const interval = 30;

    const res: any = await graph.apiRequest(
      {
        path: `/v1.0/users/${encodeURIComponent(args.organizer)}/calendar/getSchedule`,
        method: "POST",
        body: {
          schedules: args.attendees,
          startTime: { dateTime: args.startIso, timeZone },
          endTime: { dateTime: args.endIso, timeZone },
          availabilityViewInterval: interval,
        },
      },
      ctx,
    );

    const views: string[] = (res.value ?? []).map((s: any) => s.availabilityView ?? "");
    const slots = Math.min(...views.map((v) => v.length));
    const start = new Date(args.startIso).getTime();

    const commonFree: string[] = [];
    for (let i = 0; i < slots; i++) {
      if (views.every((v) => v[i] === "0")) {
        commonFree.push(new Date(start + i * interval * 60_000).toISOString());
      }
    }

    return {
      timeZone,
      perPerson: (res.value ?? []).map((s: any) => ({
        email: s.scheduleId,
        availabilityView: s.availabilityView,
        busyItems: (s.scheduleItems ?? []).length,
      })),
      commonFreeSlotStarts: commonFree,
    };
  },
});
