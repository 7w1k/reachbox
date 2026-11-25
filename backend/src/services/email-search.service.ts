
import elasticClient from "../config/elasticsearch";
import prisma from "../config/database";

const INDEX_NAME = "emails";

export async function ensureEmailIndex() {
  const exists = await elasticClient.indices.exists({
    index: INDEX_NAME,
  });

  if (!exists) {
    await elasticClient.indices.create({
      index: INDEX_NAME,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          userId: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
  }
}

export async function indexEmail(emailId: string) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  await ensureEmailIndex();

  await elasticClient.index({
    index: INDEX_NAME,
    id: email.id,
    document: {
      emailId: email.id,
      userId: email.userId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
    },
    refresh: "wait_for",
  });
}

export async function searchEmails(
  userId: string,
  query: string
) {
  await ensureEmailIndex();

  const result = await elasticClient.search({
    index: INDEX_NAME,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["recipient", "subject", "body"],
              type: "best_fields",
            },
          },
        ],
        filter: [
          {
            term: {
              userId,
            },
          },
        ],
      },
    },
    sort: [
      {
        scheduledAt: {
          order: "desc",
        },
      },
    ],
  });

  return result.hits.hits.map((hit) => hit._source);
}
