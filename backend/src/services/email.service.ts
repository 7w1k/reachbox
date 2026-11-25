
import prisma from "../config/database";
import { emailQueue } from "../queues/email.queue";
import { indexEmail } from "./email-search.service";

interface ScheduleEmailInput {
  userId: string;
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: Date;
  delaySeconds: number;
}

export async function scheduleEmails(input: ScheduleEmailInput) {
  const {
    userId,
    senderId,
    recipients,
    subject,
    body,
    startTime,
    delaySeconds,
  } = input;

  if (recipients.length === 0) {
    throw new Error("At least one recipient is required");
  }

  if (delaySeconds < 0) {
    throw new Error("Delay cannot be negative");
  }

  if (startTime.getTime() < Date.now()) {
    throw new Error("Start time cannot be in the past");
  }

  // Confirm that the sender belongs to this user.
  const sender = await prisma.sender.findFirst({
    where: {
      id: senderId,
      userId,
    },
  });

  if (!sender) {
    throw new Error("Sender not found");
  }

  const createdEmails = await prisma.$transaction(
    recipients.map((recipient, index) => {
      const scheduledAt = new Date(
        startTime.getTime() + index * delaySeconds * 1000
      );

      return prisma.email.create({
        data: {
          recipient,
          subject,
          body,
          scheduledAt,
          idempotencyKey: `${userId}-${senderId}-${crypto.randomUUID()}`,
          userId,
          senderId,
        },
      });
    })
  );
  await Promise.allSettled(
    createdEmails.map((email) => indexEmail(email.id))
  );

  // Add each email to the delayed queue.
  try {
    await emailQueue.addBulk(
      createdEmails.map((email) => ({
        name: "send-email",
        data: {
          emailId: email.id,
        },
        opts: {
          jobId: `email-${email.id}`,
          delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
        },
      }))
    );
  } catch (error) {
    // Mark records as failed if queue insertion fails.
    await prisma.email.updateMany({
      where: {
        id: { in: createdEmails.map((email) => email.id) },
        status: "SCHEDULED",
      },
      data: {
        status: "FAILED",
        lastError: "Failed to add email to queue",
      },
    });

    throw error;
  }

  return {
    count: createdEmails.length,
    emails: createdEmails,
  };
}
