# 統計とデータ可視化機能

## 概要

Task 5.3で実装された統計とデータ可視化機能は、Chrome拡張機能のポップアップ広告ブロッカーに包括的な統計分析とデータ可視化機能を追加します。

## 実装された機能

### 1. バックグラウンドワーカーでのgetStatistics()関数の拡張

#### 基本統計の拡張
- 従来の基本統計（総検出数、総ブロック数、総保持数）
- 新しい拡張統計（ウェブサイト別、時系列、効果メトリクス、アクティビティトレンド）

#### 新しいメッセージハンドラー
- `GET_WEBSITE_STATISTICS`: 特定ウェブサイトの統計を取得
- `GET_ACTIVITY_TRENDS`: アクティビティトレンドを取得
- `GET_DETAILED_STATISTICS`: フィルタリング対応の詳細統計を取得

### 2. ウェブサイトごとのポップアップブロック統計

#### 機能
- ドメイン別の検出数、ブロック数、保持数の集計
- ブロック率の計算
- 平均応答時間の計算
- 最後のアクティビティ時刻の記録

#### データ構造
```javascript
{
  domain: 'example.com',
  totalDetected: 10,
  totalClosed: 8,
  totalKept: 2,
  totalTimeout: 0,
  blockRate: 80.0,
  lastActivity: 1753578250628,
  averageResponseTime: 2500
}
```

### 3. 総ブロックポップアップカウンターと効果メトリクス

#### 期間別メトリクス
- 今日、今週、今月、全期間の統計
- ブロック率、保持率、タイムアウト率
- 平均応答時間

#### 効果測定
- 時系列でのブロック効果の変化
- ユーザーの応答パターン分析
- パフォーマンス指標（応答時間の分布）

### 4. ユーザーアクティビティトレンドのデータ可視化

#### 時間別アクティビティ
- 24時間の時間別アクティビティ分布
- 曜日別のアクティビティパターン
- アクティビティの変化トレンド（増加/減少/安定）

#### 可視化コンポーネント
- ウェブサイト別ブロック数の棒グラフ
- 時間別アクティビティのヒートマップ
- 効果メトリクスの表示
- トレンド指標

## API仕様

### getStatistics()
拡張された統計データを返します。

```javascript
const statistics = await chrome.runtime.sendMessage({
  type: 'GET_STATISTICS'
});
```

#### 戻り値
```javascript
{
  // 基本統計
  totalPopupsDetected: 100,
  totalPopupsClosed: 80,
  totalPopupsKept: 20,
  lastResetDate: 1753578250628,
  
  // ウェブサイト別統計
  websiteStatistics: [
    {
      domain: 'example.com',
      totalDetected: 10,
      totalClosed: 8,
      // ...
    }
  ],
  
  // 時系列データ
  timeSeriesData: {
    daily: [...],
    weekly: [...],
    monthly: [...]
  },
  
  // 効果メトリクス
  effectivenessMetrics: {
    today: { blockRate: 80.0, averageResponseTime: 2500 },
    thisWeek: { ... },
    // ...
  },
  
  // アクティビティトレンド
  activityTrends: {
    hourlyActivity: [...],
    weeklyActivity: [...],
    trend: {
      recent30Days: 50,
      previous30Days: 40,
      changePercentage: 25.0,
      direction: 'increasing'
    }
  },
  
  // パフォーマンス統計
  performanceMetrics: {
    responseTime: {
      average: 2500,
      median: 2000,
      min: 1000,
      max: 5000
    },
    decisionDistribution: {
      close: 80,
      keep: 20,
      timeout: 5
    }
  }
}
```

### getWebsiteStatistics(domain)
特定ドメインの詳細統計を取得します。

```javascript
const websiteStats = await chrome.runtime.sendMessage({
  type: 'GET_WEBSITE_STATISTICS',
  domain: 'example.com'
});
```

### getActivityTrends()
アクティビティトレンドデータを取得します。

```javascript
const trends = await chrome.runtime.sendMessage({
  type: 'GET_ACTIVITY_TRENDS'
});
```

## UI拡張

### ポップアップインターフェース
- 効果メトリクスセクションの追加
- データ可視化セクションの追加
- ウェブサイト別統計の棒グラフ
- 時間別アクティビティのヒートマップ

### CSS スタイル
- `.effectiveness-metrics`: 効果メトリクス表示
- `.data-visualization-section`: データ可視化セクション
- `.chart-container`: チャートコンテナ
- `.website-chart`: ウェブサイト別チャート
- `.hourly-chart`: 時間別チャート

## テスト

### テストファイル
`chrome-extension/tests/statistics-visualization.test.js`

### テスト内容
- ウェブサイト別統計計算のテスト
- 時系列データ計算のテスト
- 効果メトリクス計算のテスト
- アクティビティトレンド計算のテスト
- パフォーマンス統計計算のテスト
- 可視化データ生成のテスト

### テスト実行
```bash
cd chrome-extension
node tests/statistics-visualization.test.js
```

## パフォーマンス考慮事項

### データ制限
- ウェブサイト統計: 上位50サイトのみ保持
- ポップアップ履歴: 最新1000件に制限
- ユーザー決定履歴: 最新500件に制限

### 計算最適化
- 統計計算のキャッシュ化
- 大量データの段階的処理
- メモリ使用量の最適化

## 今後の拡張可能性

### 高度な可視化
- より詳細なチャートライブラリの統合
- インタラクティブなグラフ
- エクスポート機能

### 機械学習統合
- パターン認識の可視化
- 予測分析の表示
- 学習効果の測定

### レポート機能
- 定期レポートの生成
- 統計データのエクスポート
- カスタムフィルタリング

## 要件対応

この実装は以下の要件を満たしています：

- **要件 4.1**: ブロックされたポップアップの統計記録
- **要件 4.2**: ウェブサイトごとのブロック統計表示
- **要件 4.3**: 総ブロックポップアップカウンターと効果メトリクス

## 使用方法

1. 拡張機能のポップアップを開く
2. 統計セクションで基本的な数値を確認
3. 効果メトリクスセクションでブロック率と応答時間を確認
4. データ可視化セクションでトップサイトと時間別アクティビティを確認
5. 詳細設定ページでより詳細な統計を確認（将来実装予定）

この機能により、ユーザーは拡張機能の効果を定量的に把握し、ポップアップブロックの傾向を理解できるようになります。