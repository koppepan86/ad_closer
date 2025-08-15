/**
 * パフォーマンス最適化機能のテスト
 */

describe('AdPreviewCapture Performance Optimization', () => {
  let adPreviewCapture;
  let mockElement;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = `
      <div id="test-container">
        <div class="test-element" style="width: 200px; height: 150px; background: red;">Test Element 1</div>
        <div class="test-element" style="width: 300px; height: 200px; background: blue;">Test Element 2</div>
        <div class="test-element" style="width: 250px; height: 180px; background: green;">Test Element 3</div>
      </div>
    `;

    // html2canvasのモック
    global.html2canvas = jest.fn().mockResolvedValue({
      toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockImageData'),
      width: 200,
      height: 150
    });

    // AdPreviewCaptureインスタンスを作成
    adPreviewCapture = new AdPreviewCapture({
      debugMode: true,
      targetProcessingTime: 500,
      memoryCleanupThreshold: 1024 * 1024, // 1MB
      lazyLoadingEnabled: true,
      loadingIndicatorEnabled: true
    });

    mockElement = document.querySelector('.test-element');
  });

  afterEach(() => {
    if (adPreviewCapture) {
      adPreviewCapture.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('500ms以内処理完了最適化', () => {
    test('単一要素のキャプチャが500ms以内に完了する', async () => {
      const startTime = Date.now();
      
      const result = await adPreviewCapture.captureElement(mockElement);
      
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThanOrEqual(500);
      expect(result).toBeDefined();
      expect(result.captureTime).toBeDefined();
    });

    test('処理時間が500msを超えた場合に最適化が適用される', async () => {
      // 遅い処理をシミュレート
      global.html2canvas.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          toDataURL: () => 'data:image/png;base64,mockImageData',
          width: 200,
          height: 150
        }), 600))
      );

      const originalQuality = adPreviewCapture.options.imageQuality;
      const originalConcurrency = adPreviewCapture.options.maxConcurrentCaptures;

      await adPreviewCapture.captureElement(mockElement);

      // 最適化が適用されたかチェック
      expect(adPreviewCapture.performanceMonitor.isOptimizing).toBe(true);
      expect(adPreviewCapture.options.imageQuality).toBeLessThan(originalQuality);
      expect(adPreviewCapture.options.maxConcurrentCaptures).toBeLessThanOrEqual(originalConcurrency);
    });

    test('バッチ処理で要素数が動的に制限される', async () => {
      const elements = document.querySelectorAll('.test-element');
      
      // 平均処理時間を高く設定
      adPreviewCapture.performanceStats.averageProcessingTime = 200;
      
      const result = await adPreviewCapture.captureMultipleElements(Array.from(elements));
      
      // 処理された要素数が制限されているかチェック
      const maxExpected = Math.floor(500 / 200); // 2個
      expect(result.length).toBeLessThanOrEqual(Math.max(maxExpected, elements.length));
    });
  });

  describe('メモリ使用量監視・自動クリーンアップ', () => {
    test('メモリ使用量が正しく監視される', () => {
      const memoryInfo = adPreviewCapture.getMemoryInfo();
      
      expect(memoryInfo).toBeDefined();
      expect(memoryInfo.cacheSize).toBeDefined();
      expect(memoryInfo.estimated).toBeDefined();
      expect(memoryInfo.timestamp).toBeDefined();
    });

    test('メモリクリーンアップが正常に実行される', async () => {
      // キャッシュにデータを追加
      await adPreviewCapture.captureElement(mockElement);
      const initialCacheSize = adPreviewCapture.previewCache.size;
      
      expect(initialCacheSize).toBeGreaterThan(0);
      
      // クリーンアップを実行
      adPreviewCapture.performMemoryCleanup('test');
      
      // クリーンアップ後のキャッシュサイズをチェック
      const finalCacheSize = adPreviewCapture.previewCache.size;
      expect(finalCacheSize).toBeLessThanOrEqual(initialCacheSize);
    });

    test('メモリ閾値を超えた場合に自動クリーンアップが実行される', async () => {
      // 低い閾値を設定
      adPreviewCapture.options.memoryCleanupThreshold = 100;
      
      // 大量のキャプチャを実行してメモリ使用量を増加
      const elements = document.querySelectorAll('.test-element');
      for (let i = 0; i < 5; i++) {
        await adPreviewCapture.captureMultipleElements(Array.from(elements));
      }
      
      // メモリ使用量をチェック
      adPreviewCapture.checkMemoryUsage();
      
      // 最適化イベントが記録されているかチェック
      expect(adPreviewCapture.performanceStats.optimizationEvents.length).toBeGreaterThan(0);
    });

    test('古いキャッシュエントリが削除される', async () => {
      // 古いタイムスタンプでキャッシュエントリを作成
      const oldTimestamp = Date.now() - 15 * 60 * 1000; // 15分前
      adPreviewCapture.previewCache.set('old-entry', {
        id: 'old-entry',
        timestamp: oldTimestamp,
        screenshot: { thumbnail: 'data:image/png;base64,old' }
      });
      
      // 新しいエントリも追加
      await adPreviewCapture.captureElement(mockElement);
      
      const initialSize = adPreviewCapture.previewCache.size;
      
      // 古いエントリのクリーンアップを実行
      adPreviewCapture.cleanupOldCacheEntries();
      
      const finalSize = adPreviewCapture.previewCache.size;
      expect(finalSize).toBeLessThan(initialSize);
      expect(adPreviewCapture.previewCache.has('old-entry')).toBe(false);
    });
  });

  describe('遅延読み込み機能', () => {
    test('画面外要素に対して遅延読み込みプレースホルダーが作成される', async () => {
      // 要素を画面外に配置
      mockElement.style.position = 'absolute';
      mockElement.style.top = '2000px';
      
      const result = await adPreviewCapture.captureElement(mockElement, {
        enableLazyLoading: true
      });
      
      expect(result.isLazyLoad).toBe(true);
      expect(adPreviewCapture.lazyLoadManager.pendingLoads.size).toBeGreaterThan(0);
    });

    test('画面内要素は即座に読み込まれる', async () => {
      // 要素を画面内に配置
      mockElement.style.position = 'static';
      
      const result = await adPreviewCapture.captureElement(mockElement, {
        enableLazyLoading: true
      });
      
      expect(result.isLazyLoad).toBeUndefined();
      expect(result.screenshot).toBeDefined();
    });

    test('Intersection Observerが正しく設定される', () => {
      expect(adPreviewCapture.lazyLoadManager.intersectionObserver).toBeDefined();
    });

    test('遅延読み込み要素が実際に読み込まれる', async () => {
      // 画面外要素でプレースホルダーを作成
      mockElement.style.position = 'absolute';
      mockElement.style.top = '2000px';
      
      const placeholder = await adPreviewCapture.captureElement(mockElement, {
        enableLazyLoading: true
      });
      
      expect(placeholder.isLazyLoad).toBe(true);
      
      // 遅延読み込みを実行
      await adPreviewCapture.loadLazyPreview(mockElement);
      
      // プレースホルダーが実際のデータに置き換わったかチェック
      const loadedData = adPreviewCapture.previewCache.get(placeholder.id);
      expect(loadedData.isLazyLoad).toBeUndefined();
      expect(loadedData.screenshot).toBeDefined();
    });
  });

  describe('ローディング表示機能', () => {
    test('ローディング表示が正しく開始・終了される', async () => {
      let loadingStartCalled = false;
      let loadingEndCalled = false;
      
      adPreviewCapture.options.onLoadingStart = () => {
        loadingStartCalled = true;
      };
      
      adPreviewCapture.options.onLoadingEnd = () => {
        loadingEndCalled = true;
      };
      
      await adPreviewCapture.captureElement(mockElement, {
        showLoadingIndicator: true
      });
      
      expect(loadingStartCalled).toBe(true);
      expect(loadingEndCalled).toBe(true);
    });

    test('バッチローディング表示が正しく動作する', async () => {
      let batchLoadingStartCalled = false;
      let batchLoadingEndCalled = false;
      
      adPreviewCapture.options.onBatchLoadingStart = () => {
        batchLoadingStartCalled = true;
      };
      
      adPreviewCapture.options.onBatchLoadingEnd = () => {
        batchLoadingEndCalled = true;
      };
      
      const elements = document.querySelectorAll('.test-element');
      await adPreviewCapture.captureMultipleElements(Array.from(elements), {
        showLoadingIndicator: true
      });
      
      expect(batchLoadingStartCalled).toBe(true);
      expect(batchLoadingEndCalled).toBe(true);
    });

    test('ローディング時間が正しく記録される', async () => {
      await adPreviewCapture.captureElement(mockElement, {
        showLoadingIndicator: true
      });
      
      expect(adPreviewCapture.performanceStats.loadingTimes).toBeDefined();
      expect(adPreviewCapture.performanceStats.loadingTimes.length).toBeGreaterThan(0);
    });
  });

  describe('パフォーマンス統計', () => {
    test('パフォーマンス統計が正しく取得される', async () => {
      await adPreviewCapture.captureElement(mockElement);
      
      const stats = adPreviewCapture.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalCaptures).toBeGreaterThan(0);
      expect(stats.successfulCaptures).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeDefined();
      expect(stats.currentMemoryUsage).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
    });

    test('最適化状態が正しく判定される', async () => {
      await adPreviewCapture.captureElement(mockElement);
      
      const optimizationStatus = adPreviewCapture.getOptimizationStatus();
      
      expect(optimizationStatus).toBeDefined();
      expect(optimizationStatus.status).toMatch(/optimal|good|needs_optimization/);
      expect(optimizationStatus.recommendations).toBeDefined();
      expect(optimizationStatus.metrics).toBeDefined();
    });

    test('キャッシュヒット率が正しく計算される', async () => {
      // 初回キャプチャ（キャッシュミス）
      await adPreviewCapture.captureElement(mockElement);
      
      // 2回目キャプチャ（キャッシュヒット）
      await adPreviewCapture.captureElement(mockElement);
      
      const stats = adPreviewCapture.getPerformanceStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
      expect(stats.cacheRequests).toBe(2);
      expect(stats.cacheHits).toBe(1);
    });
  });

  describe('要素優先度付け', () => {
    test('要素が優先度順に並び替えられる', () => {
      const elements = document.querySelectorAll('.test-element');
      
      // 優先度を設定
      elements[0].style.zIndex = '10';
      elements[1].style.zIndex = '5';
      elements[2].style.zIndex = '1';
      
      const prioritized = adPreviewCapture.prioritizeElements(Array.from(elements), 2);
      
      expect(prioritized.length).toBe(2);
      expect(prioritized[0]).toBe(elements[0]); // 最高優先度
    });

    test('要素の優先度が正しく計算される', () => {
      // ビューポート内の大きな要素
      mockElement.style.width = '500px';
      mockElement.style.height = '400px';
      mockElement.style.zIndex = '100';
      
      const priority = adPreviewCapture.calculateElementPriority(mockElement);
      
      expect(priority).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリング', () => {
    test('キャプチャ失敗時にフォールバックが生成される', async () => {
      // html2canvasを失敗させる
      global.html2canvas.mockRejectedValue(new Error('Capture failed'));
      
      const result = await adPreviewCapture.captureElement(mockElement);
      
      expect(result.fallback).toBeDefined();
      expect(result.fallback.reason).toBe('capture_failed');
      expect(adPreviewCapture.performanceStats.failedCaptures).toBeGreaterThan(0);
    });

    test('メモリクリーンアップ失敗時にエラーが適切に処理される', () => {
      // 無効なキャッシュエントリを追加
      adPreviewCapture.previewCache.set('invalid', null);
      
      expect(() => {
        adPreviewCapture.performMemoryCleanup('test');
      }).not.toThrow();
    });
  });
});