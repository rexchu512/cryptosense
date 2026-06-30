# CryptoSense

加密貨幣「進場前風險研究」助手（作品集 P1）。市場總覽 + 個幣頁（行情/新聞）+ 情境感知 AI 問答（即時行情 / 新聞 / 個人知識庫 3 工具）。

- **線上 Demo**：https://cryptosense-production.up.railway.app
- 技術：Next.js 16 (App Router) · TypeScript · Tailwind · Vercel AI SDK v7 · OpenAI File Search · 部署於 Railway
- 規格與計畫：見 repo 的 `docs/superpowers/specs` 與 `docs/superpowers/plans`

## 本機開發

```bash
cd cryptosense
cp .env.local.example .env.local   # 填入 OPENAI_API_KEY（AI 問答必需）等
npm install
npm run dev                         # http://localhost:3000
npm test                            # 38 tests
```

行情與新聞免金鑰即可跑；AI 問答需 `OPENAI_API_KEY`；個人知識庫需先 `npx tsx --env-file=.env.local scripts/ingest.ts ./knowledge` 取得並設定 `OPENAI_VECTOR_STORE_ID`。
