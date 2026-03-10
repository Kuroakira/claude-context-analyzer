# Decision Record: Frontend Approach

**Date**: 2026-03-10
**Status**: Decided

## Context
Design DocではVanilla JS + npx配布を採択していたが、セッション一覧のフィルタ、ポップアップ表示、検索UIなど細かいUI調整を考慮すると、Reactのコンポーネントモデルの方が開発効率が高い。配布方式は段階的に決定する。

## Options Considered
- **Vanilla JS + npx**: ビルドなし、即配布可能。UIが複雑化すると管理困難。
- **React + clone-and-run**: React + Viteで開発。まず手元で動かして調整。
- **React + bundled npm**: React開発 + ビルド済みnpm配布。clone-and-runで安定したら移行。
- **VSCode Extension**: 別途検討事項として保留。

## Decision
**Selected**: React + clone-and-run（段階的にbundled npmへ移行）

**Rationale**: まず手元で動かしながらUIを調整し、安定したらbundled npmで配布する段階的アプローチ。React + Viteの開発体験（HMR、コンポーネント、TypeScript）を活かしつつ、配布方式の判断を先送りできる。

## When to Reconsider
- UIが想定以上にシンプルで、Reactのオーバーヘッドが目立つ場合
- bundled npm移行時にビルドパイプラインの維持コストが高い場合
- VSCode Extensionの方がユーザー体験として優れることが判明した場合
