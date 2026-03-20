# DeadlineAI Backend

AI-powered academic deadline tracker for university students. Built for Techkriti 2026 hackathon.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │────▶│ API Gateway  │────▶│  Lambda Functions │
│   (React)    │     │   (REST)     │     │   (Node.js 20)    │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
       ┌──────────────────────────────────────────┤
       │                  │                  │      │
  ┌────▼────┐    ┌───────▼──────┐   ┌──────▼───┐  │
  │DynamoDB │    │ AWS Bedrock  │   │   S3     │  │
  │(Single  │    │ (Claude AI)  │   │ (PDFs)   │  │
  │ Table)  │    └──────────────┘   └──────────┘  │
  └────┬────┘                                      │
       │                                           │
  ┌────▼────────┐   ┌──────────────┐   ┌──────────▼───┐
  │ DynamoDB    │   │ EventBridge  │   │   Twilio     │
  │  Streams    │──▶│  (Cron)      │──▶│  WhatsApp    │
  └─────────────┘   └──────────────┘   └──────────────┘

  ┌──────────────┐     ┌──────────────┐
  │  WebSocket   │────▶│ Squad Sync   │
  │  API GW      │     │  (Lambda)    │
  └──────────────┘     └──────────────┘
```

## Prerequisites

- Node.js 20+
- AWS CLI v2 configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Twilio account (for WhatsApp/SMS)
- AWS account with Bedrock Claude access enabled

## SSM Parameter Setup

Run these commands before deploying (replace values with your actual credentials):

```bash
aws ssm put-parameter \
  --name "/deadlineai/anthropic/api-key" \
  --type SecureString \
  --value "YOUR_ANTHROPIC_API_KEY" \
  --overwrite

aws ssm put-parameter \
  --name "/deadlineai/twilio/account-sid" \
  --type SecureString \
  --value "YOUR_TWILIO_ACCOUNT_SID" \
  --overwrite

aws ssm put-parameter \
  --name "/deadlineai/twilio/auth-token" \
  --type SecureString \
  --value "YOUR_TWILIO_AUTH_TOKEN" \
  --overwrite

aws ssm put-parameter \
  --name "/deadlineai/twilio/whatsapp-from" \
  --type String \
  --value "whatsapp:+14155238886" \
  --overwrite
```

## Deploy in 3 Commands

```bash
# 1. Clone and install
npm install

# 2. Deploy to AWS
./scripts/deploy.sh

# 3. Seed demo data
node scripts/seed-demo-data.js
```

## Demo Seeder

Seeds realistic demo data for judge demo:

```bash
node scripts/seed-demo-data.js
```

Creates:
- 1 demo user (Arjun Sharma)
- 12 deadlines across 4 B.Tech courses (CS301, MA201, PH101, EE201)
- 1 verified clash (CS301 Midterm + MA201 Assignment within 2 days, 35% combined weight)
- 1 crunch week with stress score > 60
- 1 study squad with 3 members (invite code: DEMO01)

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/syllabi/upload` | Yes | Upload PDF syllabus, extract deadlines via AI |
| POST | `/deadlines/confirm` | Yes | Confirm extracted deadlines after user review |
| GET | `/deadlines` | Yes | Get all deadlines (filter: `from`, `to`, `status`) |
| GET | `/deadlines/clashes` | Yes | Detect clashing deadlines (`?plan=true` for AI rescue plan) |
| POST | `/deadlines/{id}/pace` | Yes | Generate AI study pace sessions |
| POST | `/autopsies` | Yes | Submit deadline debrief, get AI insights (3+ debriefs) |
| POST | `/squads` | Yes | Create study squad |
| POST | `/squads/join` | Yes | Join squad by invite code |
| GET | `/squads` | Yes | List user's squads |
| GET | `/squads/{id}` | Yes | Get squad board with member deadlines |
| DELETE | `/squads/{id}` | Yes | Leave a squad |

**Auth:** Include `Authorization: Bearer <cognito_id_token>` header.

**WebSocket:** `wss://<ws-url>/prod?userId=<id>&squadId=<id>`

## Free Tier Usage Estimate (Monthly)

| Service | Free Tier Limit | Estimated Usage |
|---------|----------------|-----------------|
| Lambda | 1M requests, 400K GB-s | ~10K requests, ~5K GB-s |
| API Gateway | 1M calls | ~10K calls |
| DynamoDB | 25 GB, 25 WCU/RCU | ~100MB, on-demand |
| S3 | 5 GB, 20K GET | ~500MB temp PDFs (auto-deleted) |
| Bedrock | Pay-per-use | ~$2-5 for demo usage |
| EventBridge | 14M events | ~3K events |
| CloudWatch | 5 GB logs | ~100MB logs |
| Cognito | 50K MAU | <100 users |

## Project Structure

```
deadlineai-backend/
├── cdk/                     # AWS CDK infrastructure (TypeScript)
│   ├── bin/app.ts
│   └── lib/
│       ├── deadlineai-stack.ts
│       └── constructs/
├── src/
│   ├── handlers/            # Lambda functions (one per file)
│   ├── lib/                 # Shared utilities
│   └── schemas/             # Zod validation schemas
└── scripts/
    ├── seed-demo-data.js
    └── deploy.sh
```
