#!/bin/bash
# One-command hackathon deploy
# Usage: ./scripts/deploy.sh [aws-profile]

set -e

PROFILE=${1:-default}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📦 Installing dependencies..."
cd "$PROJECT_DIR"
npm install

echo "📦 Installing CDK dependencies..."
cd "$PROJECT_DIR/cdk"
npm install

echo "🏗️  Bootstrapping CDK (skip if already done)..."
npx cdk bootstrap --profile "$PROFILE" 2>/dev/null || echo "  (bootstrap already done or failed — continuing)"

echo "🚀 Deploying stack..."
npx cdk deploy --profile "$PROFILE" --require-approval never --outputs-file "$PROJECT_DIR/cdk-outputs.json"

echo ""
echo "✅ Deployment complete!"
echo ""

if [ -f "$PROJECT_DIR/cdk-outputs.json" ]; then
  echo "📋 Stack Outputs:"
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$PROJECT_DIR/cdk-outputs.json', 'utf8'));
    const stack = Object.keys(d)[0];
    for (const [k, v] of Object.entries(d[stack])) {
      console.log('  ' + k + ': ' + v);
    }
  "
fi

echo ""
echo "🌱 To seed demo data, run:"
echo "  node scripts/seed-demo-data.js"
