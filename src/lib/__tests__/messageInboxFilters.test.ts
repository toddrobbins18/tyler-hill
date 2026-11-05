import { describe, expect, it } from "vitest";
import {
  messageShownInInboxList,
  messageShownInSentList,
} from "@/lib/messageInboxFilters";

const me = "staff-1";
const parent = "parent-1";

describe("inbox and sent split", () => {
  it("keeps a direct message I sent in Sent only", () => {
    const row = { sender_id: me, recipient_id: parent, thread_kind: null };
    expect(messageShownInSentList(row)).toBe(true);
    expect(messageShownInInboxList(row, me)).toBe(false);
    expect(messageShownInInboxList(row, parent)).toBe(true);
  });

  it("puts parent portal chats in Inbox for both people, not Sent", () => {
    const row = {
      sender_id: parent,
      recipient_id: me,
      thread_kind: "parent_division_leader",
    };
    expect(messageShownInSentList(row)).toBe(false);
    expect(messageShownInInboxList(row, parent)).toBe(true);
    expect(messageShownInInboxList(row, me)).toBe(true);
    expect(messageShownInInboxList(row, "someone-else")).toBe(false);
  });

  it("hides division channels from Inbox and Sent", () => {
    const row = { sender_id: me, recipient_id: null, thread_kind: "division_channel" };
    expect(messageShownInSentList(row)).toBe(false);
    expect(messageShownInInboxList(row, me)).toBe(false);
  });

  it("shows a thread in Inbox when someone replies to me", () => {
    const row = { sender_id: me, recipient_id: parent, thread_kind: null };
    expect(messageShownInInboxList(row, me, { hasInboundReply: true })).toBe(true);
  });
});
