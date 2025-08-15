/**
 * パフォーマンス最適化実装の検証スクリプト
 */

// Node.js環境での実行用
if (typeof window === 'undefined') {
  // DOM環境をシミュレート
  global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    scrollX: 0,
    scrollY: 0,
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: () => {},
    requestAnimationFrame: (callback) => setTimeout(callback, 16)
  };
  
  global.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 200, height: 150, bottom: 150, right: 200 }),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: () => {},
      contains: () => true,
      dataset: {}
    }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {} },
    documentElement: { scrollWidth: 1920, scrollHeight: 1080, clientWidth: 1920, clientHeight: 1080 },
    readyState: 'complete',
    hidden: false,
    head: { appendChild: () => {} }
  };
  
  global.performance = {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 10 * 1024 * 1024,
      totalJSHeapSize: 50 * 1024 * 1024,
      jsHeapSizeLimit: 100 * 1024 * 1024
    },
    timing: {
      navigationStart: Date.now() - 1000,
      loadEventEnd: Date.now()
    },
    getEntriesByType: () => []
  };
  
  global.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  
  global.html2canvas = () => Promise.resolve({
    toDataURL: () => 'data:image/png;base64,mockImageData',
    width: 200,
    height: 150,
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(200 * 150 * 4) }),
      putImageData: () => {}
    })
  });
  
  // AdPreviewCaptureクラスを読み込み
  const fs = require('fs');
  const path = require('path');
  const adPreviewCaptureCode = fs.readFileSync(path.join(__dirname, 'content/ad-preview-capture.js'), 'utf8');
  eval(adPreviewCaptureCode);
}

/**
 * パフォーマンス最適化機能の検証
 */
async function validatePerformanceOptimization() {
  console.log('🚀 パフォーマンス最適化機能の検証を開始します...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  function test(name, testFn) {
    return new Promise(async (resolve) => {
      try {
        console.log(`📋 テスト: ${name}`);
        await testFn();
        console.log(`✅ 成功: ${name}\n`);
        results.passed++;
        results.tests.push({ name, status: 'passed' });
        resolve();
      } catch (error) {
        console.log(`❌ 失敗: ${name}`);
        console.log(`   エラー: ${error.message}\n`);
        results.failed++;
        results.tests.push({ name, status: 'failed', error: error.message });
        resolve();
      }
    });
  }
  
  // AdPreviewCaptureインスタンスを作成
  const adPreviewCapture = new AdPreviewCapture({
    debugMode: true,
    targetProcessingTime: 500,
    memoryCleanupThreshold: 1024 * 1024, // 1MB
    lazyLoadingEnabled: true,
    loadingIndicatorEnabled: true
  });
  
  await adPreviewCapture.waitForInit();
  
  // テスト1: 初期化の確認
  await test('初期化の確認', async () => {
    if (!adPreviewCapture.initialized) {
      throw new Error('AdPreviewCaptureが初期化されていません');
    }
    
    if (!adPreviewCapture.performanceMonitor) {
      throw new Error('パフォーマンス監視が初期化されていません');
    }
    
    if (!adPreviewCapture.lazyLoadManager) {
      throw new Error('遅延読み込み管理が初期化されていません');
    }
    
    if (!adPreviewCapture.performanceStats) {
      throw new Error('パフォーマンス統計が初期化されていません');
    }
  });
  
  // テスト2: メモリ監視機能
  await test('メモリ監視機能', async () => {
    const memoryInfo = adPreviewCapture.getMemoryInfo();
    
    if (!memoryInfo) {
      throw new Error('メモリ情報が取得できません');
    }
    
    if (typeof memoryInfo.estimated !== 'number') {
      throw new Error('推定メモリ使用量が数値ではありません');
    }
    
    if (typeof memoryInfo.cacheSize !== 'number') {
      throw new Error('キャッシュサイズが数値ではありません');
    }
    
    if (typeof memoryInfo.timestamp !== 'number') {
      throw new Error('タイムスタンプが数値ではありません');
    }
  });
  
  // テスト3: メモリクリーンアップ機能
  await test('メモリクリーンアップ機能', async () => {
    // ダミーキャッシュエントリを追加
    adPreviewCapture.previewCache.set('test-entry', {
      id: 'test-entry',
      timestamp: Date.now(),
      screenshot: { thumbnail: 'data:image/png;base64,test' }
    });
    
    const initialSize = adPreviewCapture.previewCache.size;
    if (initialSize === 0) {
      throw new Error('テスト用キャッシュエントリが追加されていません');
    }
    
    // クリーンアップを実行
    adPreviewCapture.performMemoryCleanup('test');
    
    // クリーンアップが実行されたことを確認
    if (!adPreviewCapture.performanceStats.optimizationEvents) {
      throw new Error('最適化イベントが記録されていません');
    }
  });
  
  // テスト4: 遅延読み込み機能
  await test('遅延読み込み機能', async () => {
    if (!adPreviewCapture.options.lazyLoadingEnabled) {
      throw new Error('遅延読み込みが有効になっていません');
    }
    
    if (!adPreviewCapture.lazyLoadManager.intersectionObserver) {
      throw new Error('Intersection Observerが初期化されていません');
    }
    
    // 画面外要素の判定テスト
    const mockElement = {
      getBoundingClientRect: () => ({ top: 2000, left: 0, width: 200, height: 150, bottom: 2150, right: 200 })
    };
    
    const isInViewport = adPreviewCapture.isElementInViewport(mockElement);
    if (isInViewport) {
      throw new Error('画面外要素が画面内と判定されています');
    }
  });
  
  // テスト5: ローディング表示機能
  await test('ローディング表示機能', async () => {
    if (!adPreviewCapture.options.loadingIndicatorEnabled) {
      throw new Error('ローディング表示が有効になっていません');
    }
    
    // ローディング表示のテスト
    adPreviewCapture.showLoadingIndicator('test-loading', {});
    
    if (!adPreviewCapture.lazyLoadManager.loadingStates.has('test-loading')) {
      throw new Error('ローディング状態が記録されていません');
    }
    
    adPreviewCapture.hideLoadingIndicator('test-loading');
    
    if (adPreviewCapture.lazyLoadManager.loadingStates.has('test-loading')) {
      throw new Error('ローディング状態が削除されていません');
    }
  });
  
  // テスト6: パフォーマンス統計機能
  await test('パフォーマンス統計機能', async () => {
    const stats = adPreviewCapture.getPerformanceStats();
    
    if (!stats) {
      throw new Error('パフォーマンス統計が取得できません');
    }
    
    const requiredFields = [
      'totalCaptures', 'successfulCaptures', 'failedCaptures', 'successRate',
      'averageProcessingTime', 'targetProcessingTime', 'isWithinTarget',
      'currentMemoryUsage', 'memoryPeakUsage', 'memoryThreshold',
      'cacheSize', 'cacheHitRate', 'lazyLoadEnabled', 'configuration'
    ];
    
    for (const field of requiredFields) {
      if (!(field in stats)) {
        throw new Error(`統計フィールド '${field}' が存在しません`);
      }
    }
  });
  
  // テスト7: 最適化状態判定機能
  await test('最適化状態判定機能', async () => {
    const optimizationStatus = adPreviewCapture.getOptimizationStatus();
    
    if (!optimizationStatus) {
      throw new Error('最適化状態が取得できません');
    }
    
    if (!optimizationStatus.status) {
      throw new Error('最適化状態が設定されていません');
    }
    
    if (!['optimal', 'good', 'needs_optimization'].includes(optimizationStatus.status)) {
      throw new Error(`無効な最適化状態: ${optimizationStatus.status}`);
    }
    
    if (!Array.isArray(optimizationStatus.recommendations)) {
      throw new Error('推奨事項が配列ではありません');
    }
    
    if (!optimizationStatus.metrics) {
      throw new Error('メトリクスが含まれていません');
    }
  });
  
  // テスト8: 要素優先度付け機能
  await test('要素優先度付け機能', async () => {
    const mockElements = [
      { 
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }),
        classList: { contains: () => false },
        tagName: 'DIV',
        style: { zIndex: '1' }
      },
      { 
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 200, height: 200, bottom: 200, right: 200 }),
        classList: { contains: () => true },
        tagName: 'DIV',
        style: { zIndex: '10' }
      },
      { 
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 150, height: 150, bottom: 150, right: 150 }),
        classList: { contains: () => false },
        tagName: 'IFRAME',
        style: { zIndex: '5' }
      }
    ];
    
    // window.getComputedStyleのモック
    global.window.getComputedStyle = (element) => ({
      zIndex: element.style.zIndex || '0',
      opacity: '1',
      display: 'block',
      visibility: 'visible'
    });
    
    const prioritized = adPreviewCapture.prioritizeElements(mockElements, 2);
    
    if (prioritized.length !== 2) {
      throw new Error(`優先度付け後の要素数が正しくありません: ${prioritized.length}`);
    }
    
    // 最高優先度の要素が最初に来ることを確認
    const firstElementPriority = adPreviewCapture.calculateElementPriority(prioritized[0]);
    const secondElementPriority = adPreviewCapture.calculateElementPriority(prioritized[1]);
    
    if (firstElementPriority < secondElementPriority) {
      throw new Error('要素の優先度順序が正しくありません');
    }
  });
  
  // テスト9: 処理時間最適化機能
  await test('処理時間最適化機能', async () => {
    // 遅い処理をシミュレート
    const slowProcessingTime = 600; // 500msを超える
    
    adPreviewCapture.handleSlowProcessing(slowProcessingTime);
    
    if (!adPreviewCapture.performanceMonitor.isOptimizing) {
      throw new Error('遅い処理に対する最適化が開始されていません');
    }
    
    // 最適化イベントが記録されているか確認
    const optimizationEvents = adPreviewCapture.performanceStats.optimizationEvents;
    const slowProcessingEvent = optimizationEvents.find(event => event.type === 'slow_processing');
    
    if (!slowProcessingEvent) {
      throw new Error('遅い処理の最適化イベントが記録されていません');
    }
    
    if (slowProcessingEvent.processingTime !== slowProcessingTime) {
      throw new Error('最適化イベントの処理時間が正しくありません');
    }
  });
  
  // テスト10: バッチ処理最適化機能
  await test('バッチ処理最適化機能', async () => {
    const mockElements = Array.from({ length: 10 }, (_, i) => ({
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }),
      classList: { contains: () => false },
      tagName: 'DIV',
      style: { zIndex: '1' }
    }));
    
    // 平均処理時間を高く設定
    adPreviewCapture.performanceStats.averageProcessingTime = 200;
    
    const prioritized = adPreviewCapture.prioritizeElements(mockElements, 5);
    
    if (prioritized.length > 5) {
      throw new Error('バッチサイズ制限が適用されていません');
    }
    
    // バッチ処理統計の更新テスト
    adPreviewCapture.updateBatchProcessingStats(1000, 5, 4);
    
    if (!adPreviewCapture.performanceStats.batchStats) {
      throw new Error('バッチ処理統計が初期化されていません');
    }
    
    const batchStats = adPreviewCapture.performanceStats.batchStats;
    if (batchStats.totalBatches !== 1) {
      throw new Error('バッチ数が正しく記録されていません');
    }
    
    if (batchStats.totalElements !== 5) {
      throw new Error('要素数が正しく記録されていません');
    }
  });
  
  // クリーンアップ
  adPreviewCapture.cleanup();
  
  // 結果の表示
  console.log('📊 検証結果:');
  console.log(`✅ 成功: ${results.passed}件`);
  console.log(`❌ 失敗: ${results.failed}件`);
  console.log(`📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`);
  
  if (results.failed > 0) {
    console.log('❌ 失敗したテスト:');
    results.tests.filter(t => t.status === 'failed').forEach(test => {
      console.log(`   - ${test.name}: ${test.error}`);
    });
    console.log('');
  }
  
  const overallStatus = results.failed === 0 ? '🎉 全テスト成功!' : '⚠️  一部テストが失敗しました';
  console.log(overallStatus);
  
  return results.failed === 0;
}

// 実行
if (require.main === module) {
  validatePerformanceOptimization()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('検証中にエラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { validatePerformanceOptimization };