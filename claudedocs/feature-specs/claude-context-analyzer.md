# FeatureSpec: Claude Context Analyzer

## Problem Statement

Claude Codeを日常的に使う中で、コンテキストウィンドウが何によってどれだけ消費されているかが不透明。CLAUDE.md、MCPサーバーの指示、スキル定義、ツール結果、会話履歴など多くの要素がコンテキストを占有しているが、どれがどの程度影響しているかを定量的に把握する手段がない。

現状の回避策は「なんとなくコンテキストが大きい気がする」という感覚的な判断のみで、plugin構成やプロセスの改善を合理的に判断できない。

## Overview

### システム概要

Claude Codeは会話ログを `~/.claude/projects/[project-path]/[sessionId].jsonl` にJSONL形式（1行1JSONオブジェクト）で記録している。各アシスタント応答には `usage` フィールドとしてそのターンの累積token数（input_tokens, output_tokens等）が含まれる。

Claude Context Analyzerは、このJSONLファイルを解析し、セッション内のtoken消費推移をブラウザベースのダッシュボードで可視化するツールである。ファイルの変更を監視し、作業中にライブ更新されるダッシュボードを提供する。

### Key Concepts

- **セッション**: Claude Codeとの1つの会話。1つのJSONLファイルに対応する（UUID形式のファイル名）
- **ターン**: 1つのユーザーメッセージとそれに対するアシスタント応答のペア
- **input_tokens**: そのターンでClaude APIに送信された累積トークン数（システムプロンプト + 会話履歴 + ツール結果すべてを含む）
- **output_tokens**: そのターンでClaude APIが生成したトークン数
- **cache tokens**: Anthropic APIのプロンプトキャッシュ機構に関するメトリクス。`cache_read_input_tokens`（キャッシュから読み取られたtoken数）と `cache_creation_input_tokens`（新たにキャッシュされたtoken数）がある。キャッシュ効率が高いほどコスト削減につながるため、最適化の指標として有用
- **JONLレコード**: ログファイルの各行。トップレベルの `type` フィールドで `user`, `assistant`, `progress`, `file-history-snapshot`, `queue-operation` に分類される
- **content配列**: `user`/`assistant` レコード内の `message.content[]` 配列。テキスト（`text`）、思考（`thinking`）、ツール呼び出し（`tool_use`）、ツール結果（`tool_result`）などの要素を含む
- **サブエージェント**: Claude Codeが並列処理のために起動する子プロセス。`subagents/*.jsonl` としてセッションディレクトリ内に記録される

## User Stories

### 開発者として、セッション中のToken消費推移をライブ更新で見たい
Claude Codeで作業している最中に、ブラウザのダッシュボードを開いておけば、メッセージごとのinput_tokens/output_tokensの推移が折れ線グラフで表示される。「このツール呼び出しの後にinputが急増した」といった変化を把握でき、作業スタイルの改善に活かせる。

### 開発者として、Token消費とユーザーリクエストを紐づけて分析したい
グラフ上の各データポイントをクリックすると、そのターンでのユーザーリクエスト内容が表示される。「この操作をした後にコンテキストがこう変化した」という因果関係を追跡できる。

### 開発者として、セッション単位でToken消費を比較したい
過去のセッション一覧（日時順、プロジェクトパスとセッション開始時刻を表示）から選択して、各セッションのToken消費パターンを確認できる。プラグイン構成を変更した前後で比較し、改善効果を定量的に評価できる。

### 開発者として、ツールをすぐに使い始めたい
コマンドを実行すると、現在のプロジェクトに対応するセッションを自動検出してダッシュボードが起動する。設定不要で使い始められる。

### 開発者として、目的のセッションを素早く見つけたい
複数のセッションがUUID形式のファイル名で保存されているため、どれが探しているセッションか判別しにくい。セッション一覧画面で以下の方法で検索・絞り込みができる：
- **キーワード検索**: ユーザーメッセージの内容をテキスト検索できる（例：「feature-spec」「リファクタリング」で検索）
- **日時フィルタ**: 日付範囲で絞り込める（例：「今日」「過去3日」「日付指定」）
- **セッションプレビュー**: 一覧に最初のユーザーメッセージ（セッションの目的）を要約表示し、UUIDだけでなく内容で識別できる

これにより「あの作業のときのセッション」を直感的に探し出せる。

### 開発者として、データに問題がある場合でも安全に使いたい
JONLファイルが壊れている場合や、セッションデータが存在しない場合は、ダッシュボード上に明確なメッセージが表示される。ツールがクラッシュしたり、無言で失敗することはない。

## Scope

### In Scope
- `~/.claude/projects/[project-path]/*.jsonl` ファイルの解析（既存ログデータの読み取り）
- セッション単位のToken推移可視化（input_tokens, output_tokens, cache関連metrics）
- ユーザーリクエスト内容との紐づけ表示
- メッセージ分類表示（`assistant`レコード内の`content[]`を解析し、テキスト応答・ツール呼び出し・思考ブロックを区別）
- ファイル変更監視によるライブ更新ダッシュボード
- ブラウザベースのWebダッシュボード（折れ線グラフ、棒グラフ等）
- セッション一覧・選択UI
- セッション検索・絞り込み機能（キーワード検索、日時フィルタ、セッションプレビュー表示）
- 大規模ファイル（数十MB）でも実用的な速度で動作すること
- 不正データ・エラー時のグレースフルな表示

### Out of Scope
- コンポーネント別のToken内訳推定（CLAUDE.mdが何token等）→ v2で検討
- 複数セッション横断の日次・週次トレンド分析 → v2で検討
- サブエージェント（`subagents/*.jsonl`）のデータ統合表示 → v2で検討
- Claude Code本体への変更やフック
- Token消費の最適化提案や自動改善
- 認証・マルチユーザー対応

## Purpose

### 定量的な成功指標
- セッションのJSONLファイルを解析し、ターンごとのinput_tokens/output_tokensの推移を折れ線グラフで表示できる
- ライブ更新ダッシュボードがファイル変更から5秒以内に反映される
- グラフ上のデータポイントクリックで、対応するユーザーリクエスト内容がポップアップ表示される
- 10MB以上のJSONLファイルでも初期読み込みが10秒以内に完了する
- 壊れた行・不明なレコード型はスキップされ、エラーカウントがUI上に表示される
- セッション一覧でキーワード検索を行い、50セッション中から目的のセッションを3秒以内に絞り込める
- セッション一覧の各項目に最初のユーザーメッセージ（先頭100文字程度）がプレビュー表示される

### 定性的な成功指標
- 「メッセージ単位で何tokenが使われ、どう推移しているか」をデータに基づいて確認できるようになる（ただしv1ではコンポーネント別内訳は不可）
- プラグイン構成やCLAUDE.mdの変更前後で、Token消費パターンの違いをセッション比較で評価できる
- ツールの公開・配布を通じた学びを得られる

## Risks

- **データ形式の安定性**: JONLフォーマットはClaude Code内部仕様であり、バージョンアップで変更される可能性がある。未知のフィールドは無視し、必須フィールド欠落時はグレースフルに警告する方針で対処する
- **v1の分析粒度の限界**: ログに記録されているのはターン全体のtoken数のみで、「CLAUDE.mdが何token」等のコンポーネント別内訳は得られない。v1では「何をした後にtokenがどう変化したか」の分析に限定される
- **ファイルサイズ**: 長時間セッションのJSONLファイルは数MB〜数十MBになりうる。ライブモードでは増分読み取り（末尾追加分のみ解析）で対処する
- **配布方法の選定**: npm公開、ローカルスクリプト、VSCode拡張など複数の選択肢があり、Design Docで適切な方式を検討する必要がある
- **ファイル監視の信頼性**: OSやプラットフォームによりファイル監視の挙動が異なるため、信頼性の高い実装が必要

## Environment

- **ブラウザ**: モダンブラウザ（Chrome, Firefox, Safari, Edge の最新2バージョン）
- **OS**: macOS, Linux（`~/.claude/` ディレクトリが存在する環境）。Windows は対象外（Claude Codeが主にUnix系で利用されるため）

## References

### データソース
- セッションログ: `~/.claude/projects/[encoded-project-path]/[sessionId].jsonl`
- セッション検出: `~/.claude/projects/` 配下のディレクトリスキャン（`history.jsonl`はプロンプト履歴のみでセッション索引としては使用不可）
- 利用統計（参考）: `~/.claude/stats-cache.json`

### セッション検索用メタデータ
- セッション開始時刻: 最初のレコードの`timestamp`フィールド（ISO 8601形式）
- セッションの目的: 最初の`type: "user"`レコード内の`message.content[]`からテキスト要素を抽出（`<system-reminder>`や`<ide_opened_file>`等のシステム生成テキストは除外）
- セッションID: ファイル名のUUID部分

### JONLレコード構造
- トップレベル `type`: `user`, `assistant`, `progress`, `file-history-snapshot`, `queue-operation`
- `assistant`レコードの`message.content[]`: `text`, `thinking`, `tool_use` 型の要素
- `user`レコードの`message.content[]`: `text`, `tool_result` 型の要素
- Token関連: `assistant`レコードのみに `message.usage` が存在
  - `usage.input_tokens`, `usage.output_tokens`
  - `usage.cache_creation_input_tokens`, `usage.cache_read_input_tokens`
  - `usage.cache_creation.ephemeral_5m_input_tokens`, `usage.cache_creation.ephemeral_1h_input_tokens`

### ディレクトリ構造
```
~/.claude/projects/
  -Users-username-workspace-project/     # URLエンコードされたプロジェクトパス
    abcd1234-5678-....jsonl              # セッションファイル（UUID）
    subagents/                           # サブエージェントログ（v2対象）
      *.jsonl
    tool-results/                        # ツール結果テキスト
      *.txt
```
