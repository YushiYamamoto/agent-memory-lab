# Verification Log

This file is updated manually with the important verification commands for the Zenn draft.

## Current Expected Checks

```bash
npm install
npm test
npm run typecheck
npm run build
npm run search -- --store local "ignorePublish published:false"
```

## 2026-05-14 Local Result

```text
npm install
added 66 packages
found 0 vulnerabilities

npm test
Test Files 4 passed
Tests 7 passed

npm run typecheck
passed

npm run build
passed

npm run search -- --store local "ignorePublish published:false"
top hit: codex-zenn-skill-001

Zenn preview
opened http://localhost:8100/articles/tidb-agent-memory-lab
title: RAGの次に必要だったもの: TiDB Cloudで作るAgent Memory基盤のプレビュー
```

## TiDB Checks

Run these after filling `.env` from TiDB Cloud's Connect dialog:

```bash
npm run doctor -- --store tidb
npm run seed -- --store tidb --sample
npm run search -- --store tidb "Claude Code の検索で ignorePublish を落としたくない" --project agent-memory-lab
npm run sql-editor > /tmp/agent-memory-lab.sql
```

## Cloud Resource

- TiDB Cloud instance created: `agent-memory-lab`
- Plan: Starter
- Region: Singapore (`ap-southeast-1`)
- Monthly spending limit: `$0`
