# ReachInbox – Email Scheduler

Hi! This is a full-stack email scheduling application I built for the ReachInbox.ai internship assessment. It allows users to schedule emails for multiple recipients, control the delay between emails, and track everything from a simple dashboard.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL, Prisma
- **Queue:** BullMQ and Redis
- **Email:** Nodemailer and Ethereal Email
- **Search:** Elasticsearch
- **Authentication:** Google OAuth
- **Notifications:** Slack API

## Features

**Backend**
- Google OAuth authentication.
- Schedule emails to multiple recipients with a custom start time and delay.
- BullMQ background worker for processing scheduled emails.
- Persistent jobs using Redis AOF and Docker volumes.
- Per-sender hourly rate limits and minimum delay between emails.
- Configurable worker concurrency.
- Automatic retries for failed jobs.
- Slack notifications when rate limits are reached.
- Email search using Elasticsearch.
- Bull Board for monitoring queue activity.

**Frontend**
- Google login and user profile.
- Dashboard showing scheduled and sent emails.
- Compose emails and select a sender.
- Upload recipients using CSV or TXT files.
- Configure scheduling time and sending delay.
- Separate tables for scheduled and sent emails.
- Search emails and check Slack connection status.

## Getting Started

### 1. Start the services

Make sure Docker Desktop is running. From the project root, run:

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, and Elasticsearch.

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in the backend folder:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://reachinbox:reachinbox_dev_password@localhost:5432/reachinbox?schema=public"

REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200

WORKER_CONCURRENCY=5
MIN_DELAY_SECONDS=2
MAX_EMAILS_PER_HOUR_PER_SENDER=100

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

JWT_SECRET=
SESSION_SECRET=

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=
```

Add your own Google OAuth and Slack application credentials.

Generate Prisma Client and run the database migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend:

```bash
npm run dev
```

### 3. Start the worker

Open another terminal:

```bash
cd backend
npm run worker
```

The worker runs separately from the backend and handles scheduled email jobs.

### 4. Set up the frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Ethereal Email Setup

I used Ethereal Email with Nodemailer to test email delivery without sending real emails.

When a sender doesn't have custom SMTP credentials, the application automatically creates an Ethereal test account. After an email is sent, its preview URL is printed in the worker terminal.

These emails can be viewed through the preview link but are not delivered to actual inboxes.

Custom SMTP credentials can also be configured for a sender using its SMTP host, port, username, and password.

## How It Works

When a user schedules emails, the backend creates a separate record for each recipient in PostgreSQL and adds a delayed job to BullMQ.

The scheduled time for each recipient is calculated as:

```text
startTime + (recipientIndex × delaySeconds)
```

Redis stores the BullMQ jobs, while PostgreSQL stores the email details and their statuses. Redis AOF and Docker volumes help preserve queued jobs and database records when services restart.

A separate BullMQ worker processes the jobs. Its concurrency can be changed using the `WORKER_CONCURRENCY` environment variable.

Before sending an email, the worker checks Redis-based rate limits. These enforce the hourly limit and minimum delay for each sender. If a limit is reached, the job is delayed until sending is allowed again, and a Slack notification can be sent.

## Monitoring

You can access the different services here:

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **Bull Board:** http://localhost:5000/admin/queues
- **Elasticsearch:** http://localhost:9200
- **Prisma Studio:** http://localhost:5555

To open Prisma Studio, run this from the backend folder in a separate terminal:

```bash
npx prisma studio --port 5555
```

## A Few Notes

PostgreSQL is the main source of truth, and Elasticsearch is used for email searching. Ethereal is currently used for testing; a real SMTP provider would be needed for production email delivery.

Exactly-once email delivery cannot be guaranteed when working with an external SMTP service. I have used database status checks, unique job IDs, and idempotency keys to reduce duplicate processing.