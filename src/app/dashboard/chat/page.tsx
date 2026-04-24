import type { Metadata } from "next";
import ChatClient from "@/components/chat/chat-client";

export const metadata: Metadata = { title: "Team Chat | ShortStack OS" };
export const dynamic = "force-dynamic";

/**
 * Team Chat page — Slack-style 3-pane client. Deep links via
 * ?channel=<id>&thread=<msgid> for shareable conversation links.
 */
export default function ChatPage() {
  return <ChatClient />;
}
