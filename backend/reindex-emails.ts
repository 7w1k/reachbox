
import "dotenv/config";
import prisma from "./src/config/database";
import { indexEmail } from "./src/services/email-search.service";

async function main() {
  const emails = await prisma.email.findMany({
    select: { id: true },
  });

  console.log(`Reindexing ${emails.length} emails...`);

  const results = await Promise.allSettled(
    emails.map((email) => indexEmail(email.id))
  );

  const successful = results.filter(
    (result) => result.status === "fulfilled"
  ).length;

  const failed = results.length - successful;

  console.log(`Successfully indexed: ${successful}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
