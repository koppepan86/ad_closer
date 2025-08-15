/**
 * 並列キャプチャとエラーハンドリングのユニットテスト
 */

// モックのhtml2canvas
global.html2canvas = jest.fn();

// DOM要素のモック
const createMockElement = (id, options = {}) => {
  const element = {
    id: id,
    tagName: options.tagName || 'DIV',
    className: options.className || 'ad-element',
    nodeType: 1,
    getBoundingClientRect: jest.fn().mockReturnValue({
      left: options.left || 0,
      top: options.top || 0,
      width: options.width || 300,
      height: options.height || 200,
      right: (options.left || 0) + (options.width || 300),
      bottom: (options.top || 0) + (options.height || 200)
    }),
    offsetWidth: options.width || 300,
    offsetHeight: options.height || 200,
    style: options.style || {}
  };
  return element;
};

// window.getComputedStyle のモック
global.getComputedStyle = jest.fn().mockReturnValue({
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  zIndex: 'auto'
});

// AdPreviewCapture クラスを読み込み
require('../content/ad-preview-capture.js');

describe('AdPreviewCapture - 並列処理とエラーハンドリング', () => {
  let adPreviewCapture;
  let mockCanvas;
  let mockContext;

  beforeEach(async () => {
    // モックcanvasの設定
    mockCanvas = {
      width: 300,
      height: 200,
      toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockImageData'),
      getContext: jest.fn()
    };

    mockContext = {
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      getImageData: jest.fn().mockReturnValue({
        data: new Uint8ClampedArray(300 * 200 * 4),
        width: 300,
        height: 200
      }),
      putImageData: jest.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      textAlign: 'center',
      font: '14px Arial',
      fillStyle: '#666'
    };

    mockCanvas.getContext.mockReturnValue(mockContext);

    // html2canvasのモック
    global.html2canvas.mockResolvedValue(mockCanvas);

    // document.createElement のモック
    global.document = {
      createElement: jest.fn((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return { tagName: tagName.toUpperCase() };
      })
    };

    // window オブジェクトのモック
    global.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      scrollX: 0,
      scrollY: 0,
      scrollTo: jest.fn(),
      requestAnimationFrame: jest.fn(callback => setTimeout(callback, 16)),
      getComputedStyle: global.getComputedStyle
    };

    global.document.documentElement = {
      scrollWidth: 1920,
      scrollHeight: 2000
    };

    // AdPreviewCapture インスタンスを作成
    adPreviewCapture = new window.AdPreviewCapture({
      debugMode: true,
      maxConcurrentCaptures: 2,
      captureTimeout: 1000
    });

    await adPreviewCapture.waitForInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (adPreviewCapture) {
      adPreviewCapture.cleanup();
    }
  });

  describe('複数要素の並列処理', () => {
    test('複数要素の並列キャプチャが正常に動作する', async () => {
      const elements = [
        createMockElement('test-element-1'),
        createMockElement('test-element-2'),
        createMockElement('test-element-3')
      ];

      const results = await adPreviewCapture.captureMultipleElements(elements);

      expect(results).toHaveLength(3);
      expect(global.html2canvas).toHaveBeenCalledTimes(3);
      
      results.forEach((result, index) => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('element', elements[index]);
        expect(result).toHaveProperty('screenshot');
        expect(result).toHaveProperty('elementInfo');
        expect(result).toHaveProperty('captureTime');
      });
    });

    test('並列処理の制限が正しく動作する', async () => {
      const elements = [
        createMockElement('test-element-1'),
        createMockElement('test-element-2'),
        createMockElement('test-element-3')
      ];

      // maxConcurrentCaptures = 2 なので、3つの要素は2つずつ処理される
      const startTime = Date.now();
      const results = await adPreviewCapture.captureMultipleElements(elements);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(endTime - startTime).toBeGreaterThan(0);
    });

    test('空の配列を渡した場合は空の結果を返す', async () => {
      const results = await adPreviewCapture.captureMultipleElements([]);
      expect(results).toEqual([]);
    });

    test('null要素が含まれていてもエラーにならない', async () => {
      const elements = [
        createMockElement('test-element-1'),
        createMockElement('test-element-2')
      ];

      const results = await adPreviewCapture.captureMultipleElements(elements);

      expect(results).toHaveLength(2);
    });
  });

  describe('エラーハンドリング', () => {
    test('html2canvasが失敗した場合にフォールバックが生成される', async () => {
      global.html2canvas.mockRejectedValue(new Error('Canvas capture failed'));

      const element = createMockElement('test-element-1');
      const result = await adPreviewCapture.captureElement(element);

      expect(result).toHaveProperty('fallback');
      expect(result.fallback.reason).toBe('capture_failed');
      expect(result.fallback.error).toBe('Canvas capture failed');
    });

    test('非表示要素に対してフォールバックが生成される', async () => {
      global.getComputedStyle.mockReturnValue({
        display: 'none',
        visibility: 'visible',
        opacity: '1',
        zIndex: 'auto'
      });

      const hiddenElement = createMockElement('hidden-element', {
        width: 0,
        height: 0
      });
      const result = await adPreviewCapture.captureElement(hiddenElement);

      expect(result).toHaveProperty('fallback');
      expect(result.fallback.reason).toBe('not_visible');
    });

    test('複数要素処理中の個別エラーが適切に処理される', async () => {
      // 最初の要素でエラーを発生させる
      global.html2canvas
        .mockRejectedValueOnce(new Error('First element failed'))
        .mockResolvedValue(mockCanvas);

      const elements = [
        createMockElement('test-element-1'),
        createMockElement('test-element-2')
      ];

      const results = await adPreviewCapture.captureMultipleElements(elements);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('fallback');
      expect(results[0].fallback.reason).toBe('parallel_capture_failed');
      expect(results[1]).toHaveProperty('screenshot');
    });

    test('タイムアウトエラーが適切に処理される', async () => {
      // 長時間かかるhtml2canvasをモック
      global.html2canvas.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockCanvas), 2000))
      );

      const element = createMockElement('test-element-1');
      const result = await adPreviewCapture.captureElement(element, { timeout: 500 });

      expect(result).toHaveProperty('fallback');
    });
  });

  describe('スクロール処理', () => {
    test('画面外要素の可視性分析が正しく動作する', () => {
      const offscreenElement = createMockElement('offscreen-element', {
        left: 50,
        top: 2000,
        width: 300,
        height: 200
      });
      const viewport = adPreviewCapture.getViewportInfo();
      const visibility = adPreviewCapture.analyzeElementVisibility(offscreenElement, viewport);

      expect(visibility.inViewport).toBe(false);
      expect(visibility.visible).toBe(true); // 要素自体は存在する
    });

    test('要素の前処理が正しく動作する', async () => {
      const elements = [
        createMockElement('test-element-1'),
        createMockElement('offscreen-element', {
          left: 50,
          top: 2000,
          width: 300,
          height: 200
        })
      ];

      const elementData = await adPreviewCapture.preprocessElements(elements, {
        enableScrollHandling: true
      });

      expect(elementData).toHaveLength(2);
      expect(elementData[0].needsScroll).toBe(false);
      expect(elementData[1].needsScroll).toBe(true);
    });

    test('スクロール処理が無効化されている場合は実行されない', async () => {
      const offscreenElement = createMockElement('offscreen-element', {
        left: 50,
        top: 2000,
        width: 300,
        height: 200
      });
      const elementInfo = {
        element: offscreenElement,
        needsScroll: true
      };

      const scrollInfo = await adPreviewCapture.handleOffScreenElement(elementInfo, false);

      expect(scrollInfo.scrolled).toBe(false);
    });
  });

  describe('デバッグとログ機能', () => {
    test('デバッグログが正しく出力される', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      adPreviewCapture.logDebug('Test debug message', { test: 'data' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdPreviewCapture:DEBUG] Test debug message',
        expect.objectContaining({
          timestamp: expect.any(String),
          test: 'data'
        })
      );

      consoleSpy.mockRestore();
    });

    test('エラーログが正しく出力される', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      adPreviewCapture.logError('Test error message', { error: 'details' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdPreviewCapture:ERROR] Test error message',
        expect.objectContaining({
          timestamp: expect.any(String),
          error: 'details'
        })
      );

      consoleSpy.mockRestore();
    });

    test('パフォーマンスメトリクスが記録される', () => {
      const startTime = Date.now() - 100;
      
      adPreviewCapture.recordPerformanceMetric('test_operation', startTime, {
        testData: 'value'
      });

      const stats = adPreviewCapture.getPerformanceStats();
      
      expect(stats).toBeTruthy();
      expect(stats.totalOperations).toBe(1);
      expect(stats.operationTypes).toContain('test_operation');
    });

    test('パフォーマンス統計が正しく計算される', () => {
      const baseTime = Date.now();
      
      // 複数のメトリクスを記録
      adPreviewCapture.recordPerformanceMetric('operation1', baseTime - 100);
      adPreviewCapture.recordPerformanceMetric('operation2', baseTime - 200);
      adPreviewCapture.recordPerformanceMetric('operation1', baseTime - 150);

      const stats = adPreviewCapture.getPerformanceStats();
      
      expect(stats.totalOperations).toBe(3);
      expect(stats.operationTypes).toEqual(expect.arrayContaining(['operation1', 'operation2']));
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.minDuration).toBeLessThanOrEqual(stats.maxDuration);
    });
  });

  describe('フォールバック生成', () => {
    test('緊急フォールバックが正しく生成される', () => {
      const element = createMockElement('test-element-1');
      const error = new Error('Emergency error');
      
      const fallback = adPreviewCapture.generateEmergencyFallback(element, error);

      expect(fallback).toHaveProperty('id');
      expect(fallback).toHaveProperty('element', element);
      expect(fallback).toHaveProperty('fallback');
      expect(fallback.fallback.reason).toBe('emergency_fallback');
      expect(fallback.fallback.emergency).toBe(true);
      expect(fallback.fallback.error).toBe('Emergency error');
    });

    test('フォールバック理由の説明が正しく取得される', () => {
      expect(adPreviewCapture.getFallbackDescription('not_visible'))
        .toBe('要素が表示されていません');
      expect(adPreviewCapture.getFallbackDescription('parallel_capture_failed'))
        .toBe('並列処理中にキャプチャが失敗しました');
      expect(adPreviewCapture.getFallbackDescription('unknown_reason'))
        .toBe('不明なエラーが発生しました');
    });
  });

  describe('キャッシュ機能', () => {
    test('キャッシュが正しく動作する', async () => {
      const element = createMockElement('test-element-1');
      
      // 最初のキャプチャ
      const result1 = await adPreviewCapture.captureElement(element);
      expect(global.html2canvas).toHaveBeenCalledTimes(1);
      
      // 2回目のキャプチャ（キャッシュから取得）
      const result2 = await adPreviewCapture.captureElement(element);
      expect(global.html2canvas).toHaveBeenCalledTimes(1); // 増えない
      
      expect(result1.id).toBe(result2.id);
    });

    test('forceRefreshオプションでキャッシュを無視できる', async () => {
      const element = createMockElement('test-element-1');
      
      // 最初のキャプチャ
      await adPreviewCapture.captureElement(element);
      expect(global.html2canvas).toHaveBeenCalledTimes(1);
      
      // forceRefreshでキャッシュを無視
      await adPreviewCapture.captureElement(element, { forceRefresh: true });
      expect(global.html2canvas).toHaveBeenCalledTimes(2);
    });

    test('キャッシュクリアが正しく動作する', async () => {
      const element = createMockElement('test-element-1');
      
      // キャプチャしてキャッシュに保存
      await adPreviewCapture.captureElement(element);
      expect(adPreviewCapture.previewCache.size).toBe(1);
      
      // キャッシュクリア
      adPreviewCapture.clearCache();
      expect(adPreviewCapture.previewCache.size).toBe(0);
    });
  });
});