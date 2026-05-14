# Zennfes Spring 2026 TiDB Article Plan

## Recommended Theme

PingCAP株式会社: TiDBで作るAI時代のデータ基盤

## Working Title

RAGの次に必要だったもの: TiDB Cloudで作るCodex/Claude Code横断のAgent Memory基盤

## Judge Criteria Mapping

### 完成度と再現性

- TiDB Cloud Starter の作成条件を明記する
- `.env.example` と CLI を用意する
- TiDB 接続なしでも `--store local` で検索の考え方を検証できる
- `npm test`, `npm run typecheck`, `npm run build` のログを記事に載せる

### 有益性と課題解決

- RAG の一般論ではなく、AI 開発エージェントの実運用で起きる「記憶の取り逃がし」を扱う
- 固有名詞、CLI コマンド、公開ゲート、deploy gate を検索できるようにする
- SQL のメタデータフィルタでプロジェクト別、エージェント別に絞る

### 独自性

- Codex と Claude Code の横断メモリを題材にする
- ベクトル検索だけではなく、全文検索と RRF の失敗回避を主役にする
- mem9 を「管理型の完成形」、自作 TiDB スキーマを「学習できる実装」として比較する

## Evidence Checklist

- TiDB Cloud Starter instance: `agent-memory-lab`
- Region: `Singapore (ap-southeast-1)`
- Spending limit: `$0/month`
- Local tests passing
- TypeScript build passing
- Local search output
- TiDB search output after credentials are configured

## Publication Safety

- Zenn article stays `published: false`
- No API keys or TiDB passwords in the repo
- Do not publish or apply to contest until the user explicitly asks
