
import prisma from "../config/database";
import redis from "../config/redis";

interface SlackNotificationInput {
  userId: string;
  senderId: string;
  retryAt: Date;
}

export async function sendRateLimitNotification(
  input: SlackNotificationInput
) {
  const cooldownKey = `slack-rate-alert:${input.senderId}`;

  // Allow only one notification per sender per hour
  const reserved = await redis.set(
    cooldownKey,
    "sent",
    "EX",
    3600,
    "NX"
  );

  if (!reserved) {
    console.log("Slack notification already sent recently.");
    return;
  }

  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId: input.userId },
    });

    if (!connection || !connection.channelId) {
      console.log("Slack channel not configured. Skipping notification.");
      await redis.del(cooldownKey);
      return;
    }

    const sender = await prisma.sender.findUnique({
      where: { id: input.senderId },
    });

    if (!sender) {
      await redis.del(cooldownKey);
      return;
    }

    const response = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: connection.channelId,
          text:
            `⚠️ *ReachInbox Rate Limit Alert*\n` +
            `Sender: ${sender.email}\n` +
            `Hourly limit: ${sender.hourlyLimit}\n` +
            `Emails have been temporarily delayed.\n` +
            `Next available sending time: ${input.retryAt.toLocaleString(
              "en-IN",
              { timeZone: "Asia/Kolkata" }
            )}`,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        `Slack notification failed: ${result.error || "Unknown error"}`
      );
    }

    console.log("Slack rate-limit notification sent successfully.");
  } catch (error) {
    // Permit another attempt if Slack notification failed
    await redis.del(cooldownKey);
    throw error;
  }
}
