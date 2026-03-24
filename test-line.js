import dotenv from "dotenv";
dotenv.config();

async function sendTest() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const to = process.env.LINE_USER_ID?.trim();

  if (!token || !to) {
    console.error("Missing token or to");
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
        messages: [{ type: "text", text: "test ping" }]
      }),
    });

    const errorText = await response.text();
    console.log(`Status: ${response.status} ${errorText}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

sendTest();
