# Progress

## 2026-03-10 — /claude-praxis:design: Research complete
- Decision: npm CLI + Hono server + uPlot + Vanilla JS + Polling + fs.watchFile + 全読み込み+増分追加 + 防御的解析
- Rationale: SSE/chokidar/streamingはv1には過剰。Pollingとfs.watchFileで十分な信頼性。10MBファイルの全読み込みは1秒未満で完了。
- Rejected: VSCode Extension (UIの柔軟性制約), Chart.js (バンドル4倍), WebSocket (双方向不要), React/Preact (状態が単純), chokidar (単一ファイル監視に過剰), ストリーミング解析 (v1ファイルサイズに過剰)
- Domain: token-visualization, cli-tool, jsonl-parsing

## 2026-03-10 — /claude-praxis:design: Design Doc written
- Decision: ポストホック分析を主要ユースケースとし、ライブ監視は副次的。v1はシンプルさを優先。
- Rationale: 開発者はセッション中よりセッション後にtoken消費を分析するのが自然。シンプルなアーキテクチャで要件を満たし、スケール時に複雑化する段階的アプローチ。
- Key design decisions:
  - uPlot over Chart.js: 時系列特化、50KB vs 203KB。判断期限2週間（プロトタイプで検証）
  - Polling over SSE: ローカルツールで3秒間隔ポーリングが十分
  - fs.watchFile over chokidar: 単一ファイル監視に外部依存不要
  - 全読み込み+増分 over streaming: v1ファイルサイズでは全読み込みが十分高速
  - 防御的解析+サニティチェック: 静かな失敗を防ぐ
  - コスト計算はv1ではNon-Goal: ccusageが既に提供。データモデルにmodel情報を保持しv2で対応可能に
  - キーワード検索はv1ではメタデータ限定: 全文検索はv2
- Domain: token-visualization, design-doc
