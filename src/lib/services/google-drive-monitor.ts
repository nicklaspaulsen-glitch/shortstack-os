// Google Drive Monitor — Watches client folders for new footage uploads
// Alerts editors on Slack + Telegram when unedited footage is uploaded

import { sendTelegramMessage } from "@/lib/services/trinity";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// Check a Google Drive folder for new files
export async function checkFolderForNewFiles(folderId: string, since: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size: string;
  webViewLink: string;
}>> {
  const token = process.env.GOOGLE_REFRESH_TOKEN;
  if (!token) return [];

  try {
    const query = `'${folderId}' in parents and createdTime > '${since}' and trashed = false`;
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime,size,webViewLink)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}

// Check all client folders for new footage and alert editors
export async function monitorClientFolders(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>
): Promise<{ filesFound: number; alertsSent: number }> {
  let filesFound = 0;
  let alertsSent = 0;

  // Get all clients with Drive folder URLs
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name, notes")
    .eq("is_active", true);

  if (!clients) return { filesFound, alertsSent };

  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const slackToken = process.env.SLACK_BOT_TOKEN;

  for (const client of clients) {
    // Extract Drive folder ID from client notes or a dedicated field
    const folderMatch = client.notes?.match(/drive\.google\.com\/.*folders\/([a-zA-Z0-9_-]+)/);
    if (!folderMatch) continue;

    const folderId = folderMatch[1];
    const newFiles = await checkFolderForNewFiles(folderId, since);

    if (newFiles.length === 0) continue;

    // Filter for video/media files
    const mediaFiles = newFiles.filter(f =>
      f.mimeType.startsWith("video/") ||
      f.mimeType.startsWith("image/") ||
      f.name.match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|m4v|mpg|mpeg|3gp|png|jpg|jpeg|gif|raw|cr2|nef)$/i)
    );

    if (mediaFiles.length === 0) continue;

    filesFound += mediaFiles.length;

    // Build alert message
    const fileList = mediaFiles.map(f => `  • ${f.name} (${formatFileSize(f.size)})`).join("\n");
    const message = `🎬 *New Footage Uploaded*\n\nClient: *${client.business_name}*\n${mediaFiles.length} file(s) ready for editing:\n\n${fileList}\n\n📂 Open folder: https://drive.google.com/drive/folders/${folderId}`;

    // Alert on Telegram
    if (chatId) {
      await sendTelegramMessage(chatId, message);
      alertsSent++;
    }

    // Alert on Slack
    if (slackToken) {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "#editing",
          text: message.replace(/\*/g, "*"), // Slack uses different markdown
        }),
      });
    }

    // Log in trinity
    await supabase.from("trinity_log").insert({
      action_type: "custom",
      description: `New footage detected: ${client.business_name} — ${mediaFiles.length} files`,
      client_id: client.id,
      status: "completed",
      result: { files: mediaFiles.map(f => f.name), folder_id: folderId },
      completed_at: new Date().toISOString(),
    });
  }

  return { filesFound, alertsSent };
}

function formatFileSize(bytes: string): string {
  const b = parseInt(bytes);
  if (!b || isNaN(b)) return "unknown size";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(1) + " GB";
}
