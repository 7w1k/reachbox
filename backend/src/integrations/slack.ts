
import { randomUUID } from "crypto";
import redis from "../config/redis";
import prisma from "../config/database";

const STATE_TTL_SECONDS = 600;

export async function generateSlackOAuthUrl(userId: string) {
  const state = randomUUID();

  await redis.set(
    `slack-oauth-state:${state}`,
    userId,
    "EX",
    STATE_TTL_SECONDS
  );

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: "chat:write",
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleSlackCallback(
  code: string,
  state: string
) {
  const stateKey = `slack-oauth-state:${state}`;
  const userId = await redis.get(stateKey);

  if (!userId) {
    throw new Error("Invalid or expired Slack OAuth state");
  }

  // Delete state so it cannot be reused
  await redis.del(stateKey);

  const body = new URLSearchParams({
    code,
    client_id: process.env.SLACK_CLIENT_ID!,
    client_secret: process.env.SLACK_CLIENT_SECRET!,
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
  });

  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok || !result.access_token || !result.team?.id) {
    throw new Error(
      `Slack OAuth failed: ${result.error || "Unknown error"}`
    );
  }

  await prisma.slackConnection.upsert({
    where: { userId },
    update: {
      teamId: result.team.id,
      teamName: result.team.name || null,
      botToken: result.access_token,
      botUserId: result.bot_user_id || null,
    },
    create: {
      userId,
      teamId: result.team.id,
      teamName: result.team.name || null,
      botToken: result.access_token,
      botUserId: result.bot_user_id || null,
    },
  });

  return {
    teamName: result.team.name,
    teamId: result.team.id,
  };
}
