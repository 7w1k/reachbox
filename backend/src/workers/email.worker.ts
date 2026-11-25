
import "dotenv/config";

import { Worker, Job, DelayedError } from "bullmq";
import redis from "../config/redis";
import prisma from "../config/database";
import { EMAIL_QUEUE } from "../queues/email.queue";
import { getTransporter } from "../integrations/mailer";
import nodemailer from "nodemailer";
import { checkRateLimit } from "../services/rate-limit.service";
import { indexEmail } from "../services/email-search.service";
import { sendRateLimitNotification } from "../services/slack-notification.service";

interface EmailJobData {
  emailId: string;
}

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

async function syncEmailToSearch(emailId: string) {
  try {
    await indexEmail(emailId);
    console.log(`Email ${emailId} search index updated`);
  } catch (error) {
    console.error(`Elasticsearch indexing failed for ${emailId}:`, error);
  }
}

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE,
  async (job: Job<EmailJobData>) => {
    const { emailId } = job.data;

    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    if (email.status === "SENT" || email.status === "CANCELLED") {
      console.log(`Skipping ${emailId}: ${email.status}`);
      return;
    }

    const rateLimit = await checkRateLimit({
      senderId: email.senderId,
      emailId: email.id,
      hourlyLimit: email.sender.hourlyLimit,
    });

    if (!rateLimit.allowed && rateLimit.retryAt) {
      const delay = Math.max(
        1000,
        rateLimit.retryAt.getTime() - Date.now()
      );

      try {
        await sendRateLimitNotification({
          userId: email.userId,
          senderId: email.senderId,
          retryAt: rateLimit.retryAt,
        });
      } catch (error) {
        console.error("Slack notification error:", error);
      }

      await job.moveToDelayed(Date.now() + delay, job.token);
      throw new DelayedError();
    }

    // Claim the email before processing.
    const claim = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: {
          in: ["SCHEDULED", "FAILED"],
        },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      console.log(`Email ${emailId} is already being processed`);
      return;
    }

    // Update Elasticsearch with PROCESSING status.
    await syncEmailToSearch(emailId);

    try {
      const transporter = await getTransporter(email.sender);

      const info = await transporter.sendMail({
        from: {
          name: email.sender.name || "ReachInbox",
          address: email.sender.email,
        },
        to: email.recipient,
        subject: email.subject,
        text: email.body,
      });

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });

      // Update Elasticsearch with SENT status.
      await syncEmailToSearch(emailId);

      console.log(`Email sent to ${email.recipient}`);

      const previewUrl = nodemailer.getTestMessageUrl(info);

      if (previewUrl) {
        console.log("Ethereal preview:", previewUrl);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown SMTP error";

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "FAILED",
          lastError: message,
        },
      });

      // Update Elasticsearch with FAILED status.
      await syncEmailToSearch(emailId);

      throw error;
    }
  },
  {
    connection: redis,
    concurrency,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

console.log(`Email worker started with concurrency ${concurrency}`);

async function shutdown() {
  console.log("Shutting down email worker...");
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
