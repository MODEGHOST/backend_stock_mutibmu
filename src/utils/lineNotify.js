import { env } from "../config/env.js";

/**
 * Sends a message using LINE Messaging API (LINE Bot).
 * Requires LINE_CHANNEL_ACCESS_TOKEN and LINE_USER_ID in .env
 * @param {string} message 
 */
export async function sendLineErrorAlert(message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;

  if (!token || !to) {
    console.warn("[LINE Bot] Token or User ID is missing, skipping alert.");
    return;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: to,
        messages: [{ type: "text", text: message }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LINE Bot] Failed to send message: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error("[LINE Bot] Failed to send message:", error.message);
  }
}
