# Chrome拡張機能 パフォーマンス・エラー解決方案

## 問題の概要

拡張機能使用時に以下の問題が発生している：
1. 多数のエラーが発生
2. 動作が重くなる
3. ブラウザのパフォーマンスに影響

## 根本原因分析

### 1. 高頻度検出による負荷
- 1分間に最大800回の検出処理
- バックグラウンドタブでも継続実行
- MutationObserverの過剰な監視

### 2. メモリリークの可能性
- イベントリスナーの適切な削除不足
- DOM要素の参照保持
- タイマーの適切なクリーンアップ不足

### 3. エラーハンドリングの不備
- 未処理の例外によるスタック蓄積
- 非同期処理のエラー伝播
- Chrome API呼び出し失敗の連鎖

## 即座に実装すべき解決策

### 解決策1: 検出頻度の大幅削減

```javascript
// 現在: 1分間最大800回 → 提案: 1分間最大30回
const DETECTION_LIMITS = {
    maxPerMinute: 30,           // 現在の60回からさらに削減
    backgroundMultiplier: 0,    // バックグラウンドでは完全停止
    throttleDelay: 2000,        // 2秒間隔に延長
    batchSize: 3               // バッチサイズを最小限に
};
```

### 解決策2: バックグラウンド検出の完全停止

```javascript
// タブがバックグラウンドになったら全ての検出を停止
function stopBackgroundDetection() {
    if (document.hidden) {
        clearInterval(periodicDetectionTimer);
        observer?.disconnect();
        performanceOptimizer?.pause();
        console.info('Background detection completely stopped');
    }
}
```

### 解決策3: メモリリーク防止

```javascript
// 定期的なメモリクリーンアップ
setInterval(() => {
    // 古い検出結果を削除
    cleanupOldDetectionResults();
    // 未使用のDOM参照を削除
    cleanupDOMReferences();
    // ガベージコレクションを促進
    if (window.gc) window.gc();
}, 60000); // 1分間隔
```

### 解決策4: エラー処理の強化

```javascript
// グローバルエラーハンドラーの改善
window.addEventListener('error', (event) => {
    console.error('Extension Error:', event.error);
    // エラー発生時は検出を一時停止
    pauseDetectionTemporarily();
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    event.preventDefault();
});
```

## 段階的実装計画

### フェーズ1: 緊急対応（即座に実装）

1. **検出頻度の制限**
   - 1分間30回に制限
   - バックグラウンドタブでの完全停止

2. **メモリ使用量の削減**
   - 検出結果の保持期間を5分に短縮
   - 不要なログ出力の削除

3. **エラーハンドリングの強化**
   - try-catch文の追加
   - 非同期処理のエラー処理

### フェーズ2: 最適化（1週間以内）

1. **パフォーマンス監視機能**
   - CPU使用率の監視
   - メモリ使用量の監視
   - 自動的な負荷軽減

2. **適応的検出間隔**
   - サイトの複雑さに応じた調整
   - ユーザーの使用パターンに基づく最適化

### フェーズ3: 長期改善（1ヶ月以内）

1. **アーキテクチャの見直し**
   - Web Workerの活用
   - 非同期処理の最適化

2. **ユーザー設定の追加**
   - パフォーマンスモードの選択
   - 検出レベルの調整

## 具体的な修正コード

### 1. 検出頻度制限の実装

```javascript
class DetectionThrottler {
    constructor() {
        this.maxDetectionsPerMinute = 30;
        this.detectionCount = 0;
        this.lastResetTime = Date.now();
        this.isBackgroundTab = document.hidden;
        
        // タブ状態の監視
        document.addEventListener('visibilitychange', () => {
            this.isBackgroundTab = document.hidden;
            if (this.isBackgroundTab) {
                this.stopAllDetection();
            } else {
                this.resumeDetection();
            }
        });
    }
    
    canDetect() {
        if (this.isBackgroundTab) return false;
        
        const now = Date.now();
        if (now - this.lastResetTime > 60000) {
            this.detectionCount = 0;
            this.lastResetTime = now;
        }
        
        return this.detectionCount < this.maxDetectionsPerMinute;
    }
    
    recordDetection() {
        this.detectionCount++;
    }
}
```

### 2. メモリリーク防止

```javascript
class MemoryManager {
    constructor() {
        this.detectionResults = new Map();
        this.domReferences = new WeakSet();
        this.timers = new Set();
        
        // 定期クリーンアップ
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 30000);
    }
    
    cleanup() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5分
        
        // 古い検出結果を削除
        for (const [key, result] of this.detectionResults) {
            if (now - result.timestamp > maxAge) {
                this.detectionResults.delete(key);
            }
        }
        
        // メモリ使用量をチェック
        if (performance.memory && performance.memory.usedJSHeapSize > 50 * 1024 * 1024) {
            console.warn('High memory usage detected, forcing cleanup');
            this.forceCleanup();
        }
    }
    
    forceCleanup() {
        this.detectionResults.clear();
        // タイマーをクリア
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
}
```

### 3. エラー処理の強化

```javascript
class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.lastErrorTime = 0;
        this.maxErrorsPerMinute = 10;
        
        this.setupGlobalErrorHandling();
    }
    
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'Global Error');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise');
            event.preventDefault();
        });
    }
    
    handleError(error, context) {
        const now = Date.now();
        
        // エラー頻度をチェック
        if (now - this.lastErrorTime > 60000) {
            this.errorCount = 0;
        }
        
        this.errorCount++;
        this.lastErrorTime = now;
        
        console.error(`Extension Error [${context}]:`, error);
        
        // エラーが多すぎる場合は機能を一時停止
        if (this.errorCount > this.maxErrorsPerMinute) {
            console.warn('Too many errors, temporarily disabling extension');
            this.temporaryDisable();
        }
    }
    
    temporaryDisable() {
        // 検出機能を一時停止
        window.extensionDisabled = true;
        
        // 5分後に再有効化
        setTimeout(() => {
            window.extensionDisabled = false;
            this.errorCount = 0;
            console.info('Extension re-enabled after error recovery');
        }, 5 * 60 * 1000);
    }
}
```

## 設定可能なパフォーマンスモード

### ライトモード（推奨）
- 検出頻度: 1分間15回
- バックグラウンド検出: 無効
- メモリ使用量: 最小限

### 標準モード
- 検出頻度: 1分間30回
- バックグラウンド検出: 無効
- メモリ使用量: 中程度

### 高性能モード（上級者向け）
- 検出頻度: 1分間60回
- バックグラウンド検出: 制限付き
- メモリ使用量: 高め

## 監視とデバッグ

### パフォーマンス監視

```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            detectionCount: 0,
            errorCount: 0,
            memoryUsage: 0,
            cpuTime: 0
        };
        
        setInterval(() => {
            this.collectMetrics();
            this.reportIfNecessary();
        }, 10000);
    }
    
    collectMetrics() {
        this.metrics.memoryUsage = performance.memory?.usedJSHeapSize || 0;
        
        // CPU使用率が高い場合は警告
        if (this.metrics.cpuTime > 100) {
            console.warn('High CPU usage detected');
            this.suggestOptimization();
        }
    }
    
    suggestOptimization() {
        console.info('Consider switching to Light Mode for better performance');
    }
}
```

## 実装優先度

### 最高優先度（今すぐ実装）
1. バックグラウンドタブでの検出完全停止
2. 検出頻度を1分間30回に制限
3. グローバルエラーハンドラーの追加

### 高優先度（今週中）
1. メモリクリーンアップ機能
2. エラー頻度による自動停止機能
3. パフォーマンス監視機能

### 中優先度（来週）
1. ユーザー設定によるモード選択
2. 適応的検出間隔調整
3. 詳細なデバッグ機能

この解決方案により、拡張機能のパフォーマンスが大幅に改善され、エラーの発生も大幅に減少することが期待されます。