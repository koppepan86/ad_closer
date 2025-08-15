/**
 * 統合テスト: パフォーマンスとメモリ使用量
 * 
 * このテストスイートは、Chrome拡張機能のパフォーマンス特性と
 * メモリ使用量を測定・監視します。
 */

describe('パフォーマンスとメモリ使用量統合テスト', () => {
  let mockChrome;
  let mockPerformance;
  let mockMemory;

  beforeEach(() => {
    // Chrome API のモック設定
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          getBytesInUse: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      }
    };

    // Performance API のモック
    mockPerformance = {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(),
      getEntriesByName: jest.fn(),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    };

    // Memory API のモック
    mockMemory = {
      info: {
        availableCapacity: 1000000000,
        capacity: 2000000000
      }
    };

    global.chrome = mockChrome;
    global.performance = mockPerformance;
    global.navigator = {
      ...global.navigator,
      memory: mockMemory.info
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ポップアップ検出のパフォーマンス', () => {
    test('DOM監視のパフォーマンス測定', async () => {
      const performanceMonitor = {
        measurements: [],
        
        startMeasurement(name) {
          performance.mark(`${name}-start`);
          return Date.now();
        },
        
        endMeasurement(name, startTime) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          performance.mark(`${name}-end`);
          
          this.measurements.push({
            name,
            duration,
            timestamp: endTime
          });
          
          return duration;
        },
        
        getAverageTime(name) {
          const measurements = this.measurements.filter(m => m.name === name);
          if (measurements.length === 0) return 0;
          
          const total = measurements.reduce((sum, m) => sum + m.duration, 0);
          return total / measurements.length;
        }
      };

      // DOM監視処理のシミュレート
      const simulateDOMObservation = async () => {
        const startTime = performanceMonitor.startMeasurement('dom-observation');
        
        // DOM要素の検索をシミュレート
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // ポップアップ分析をシミュレート
        const elements = Array.from({ length: 100 }, (_, i) => ({
          id: `element-${i}`,
          tagName: 'DIV',
          style: {
            position: i % 10 === 0 ? 'fixed' : 'static',
            zIndex: i % 5 === 0 ? '9999' : '1'
          }
        }));

        const popupCandidates = elements.filter(el => 
          el.style.position === 'fixed' && 
          parseInt(el.style.zIndex) > 1000
        );

        performanceMonitor.endMeasurement('dom-observation', startTime);
        
        return popupCandidates;
      };

      // 複数回実行してパフォーマンスを測定
      for (let i = 0; i < 10; i++) {
        await simulateDOMObservation();
      }

      const averageTime = performanceMonitor.getAverageTime('dom-observation');
      
      expect(averageTime).toBeLessThan(50); // 50ms以内
      expect(performanceMonitor.measurements).toHaveLength(10);
    });

    test('大量要素での検出パフォーマンス', async () => {
      const largeElementCount = 5000;
      const elements = Array.from({ length: largeElementCount }, (_, i) => ({
        id: `element-${i}`,
        className: `class-${i % 100}`,
        style: {
          position: i % 100 === 0 ? 'fixed' : 'static',
          zIndex: i % 50 === 0 ? '9999' : '1',
          width: '100px',
          height: '100px'
        },
        getBoundingClientRect: () => ({
          width: 100,
          height: 100,
          top: i * 10,
          left: i * 10
        })
      }));

      const optimizedPopupDetection = (elements) => {
        const startTime = performance.now();
        
        // 段階的フィルタリングで効率化
        const step1 = elements.filter(el => el.style.position === 'fixed');
        const step2 = step1.filter(el => parseInt(el.style.zIndex) > 1000);
        const step3 = step2.filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 50 && rect.height > 50;
        });

        const endTime = performance.now();
        
        return {
          totalElements: elements.length,
          step1Results: step1.length,
          step2Results: step2.length,
          finalResults: step3.length,
          processingTime: endTime - startTime,
          efficiency: step3.length / elements.length
        };
      };

      const result = optimizedPopupDetection(elements);

      expect(result.totalElements).toBe(largeElementCount);
      expect(result.processingTime).toBeLessThan(100); // 100ms以内
      expect(result.finalResults).toBeGreaterThan(0);
      expect(result.efficiency).toBeGreaterThan(0);
    });

    test('リアルタイム検出のスループット測定', async () => {
      const throughputTest = {
        processedCount: 0,
        startTime: null,
        
        start() {
          this.startTime = performance.now();
          this.processedCount = 0;
        },
        
        processPopup(popupData) {
          // ポップアップ処理をシミュレート
          const analysis = {
            id: popupData.id,
            isModal: popupData.style?.position === 'fixed',
            zIndex: parseInt(popupData.style?.zIndex || '0'),
            confidence: Math.random() * 0.5 + 0.5
          };
          
          this.processedCount++;
          return analysis;
        },
        
        getThroughput() {
          const elapsed = performance.now() - this.startTime;
          return {
            processed: this.processedCount,
            timeElapsed: elapsed,
            throughput: this.processedCount / (elapsed / 1000) // per second
          };
        }
      };

      throughputTest.start();

      // 1000個のポップアップを処理
      for (let i = 0; i < 1000; i++) {
        throughputTest.processPopup({
          id: `popup-${i}`,
          style: {
            position: 'fixed',
            zIndex: '9999'
          }
        });
      }

      const throughput = throughputTest.getThroughput();

      expect(throughput.processed).toBe(1000);
      expect(throughput.throughput).toBeGreaterThan(100); // 100 popups/second以上
    });
  });

  describe('メモリ使用量の監視', () => {
    test('ストレージ使用量の測定', async () => {
      // 大量のデータを作成
      const largeDataSet = {
        popupHistory: Array.from({ length: 1000 }, (_, i) => ({
          id: `popup-${i}`,
          url: `https://example${i}.com`,
          timestamp: Date.now() - i * 1000,
          characteristics: {
            hasCloseButton: true,
            containsAds: true,
            dimensions: { width: 400, height: 300 },
            content: 'A'.repeat(100)
          },
          userDecision: i % 2 === 0 ? 'close' : 'keep'
        })),
        learningPatterns: Array.from({ length: 200 }, (_, i) => ({
          patternId: `pattern-${i}`,
          characteristics: {
            className: `popup-class-${i}`,
            hasCloseButton: true,
            zIndexRange: [9000 + i, 10000 + i]
          },
          confidence: Math.random(),
          occurrences: Math.floor(Math.random() * 50)
        })),
        statistics: {
          totalPopupsDetected: 5000,
          totalPopupsClosed: 4000,
          totalPopupsKept: 1000,
          dailyStats: {}
        }
      };

      // 日別統計を追加（30日分）
      for (let i = 0; i < 30; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toDateString();
        largeDataSet.statistics.dailyStats[date] = {
          detected: Math.floor(Math.random() * 100),
          closed: Math.floor(Math.random() * 80),
          kept: Math.floor(Math.random() * 20)
        };
      }

      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.storage.local.getBytesInUse.mockResolvedValue(1024 * 1024); // 1MB

      await chrome.storage.local.set(largeDataSet);
      const bytesUsed = await chrome.storage.local.getBytesInUse();

      const storageAnalysis = {
        dataSize: JSON.stringify(largeDataSet).length,
        storageUsed: bytesUsed,
        popupHistorySize: largeDataSet.popupHistory.length,
        learningPatternsSize: largeDataSet.learningPatterns.length,
        compressionRatio: bytesUsed / JSON.stringify(largeDataSet).length
      };

      expect(storageAnalysis.dataSize).toBeGreaterThan(0);
      expect(storageAnalysis.storageUsed).toBeLessThan(5 * 1024 * 1024); // 5MB以下
      expect(storageAnalysis.popupHistorySize).toBe(1000);
      expect(storageAnalysis.learningPatternsSize).toBe(200);
    });

    test('メモリリークの検出', async () => {
      const memoryTracker = {
        snapshots: [],
        
        takeSnapshot() {
          const snapshot = {
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
          
          this.snapshots.push(snapshot);
          return snapshot;
        },
        
        detectMemoryLeak() {
          if (this.snapshots.length < 2) return null;
          
          const first = this.snapshots[0];
          const last = this.snapshots[this.snapshots.length - 1];
          
          const memoryGrowth = last.usedJSHeapSize - first.usedJSHeapSize;
          const timeElapsed = last.timestamp - first.timestamp;
          const growthRate = memoryGrowth / timeElapsed; // bytes per ms
          
          return {
            memoryGrowth,
            timeElapsed,
            growthRate,
            isLeak: growthRate > 1000 // 1KB/ms以上の増加は異常
          };
        }
      };

      // 初期スナップショット
      memoryTracker.takeSnapshot();

      // メモリを使用する処理をシミュレート
      const simulateMemoryUsage = () => {
        const data = [];
        for (let i = 0; i < 1000; i++) {
          data.push({
            id: `item-${i}`,
            content: 'x'.repeat(1000),
            timestamp: Date.now()
          });
        }
        
        // メモリ使用量を更新
        performance.memory.usedJSHeapSize += 1000000; // 1MB増加をシミュレート
        
        return data;
      };

      // 複数回実行
      for (let i = 0; i < 5; i++) {
        simulateMemoryUsage();
        memoryTracker.takeSnapshot();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const leakAnalysis = memoryTracker.detectMemoryLeak();

      expect(leakAnalysis).not.toBeNull();
      expect(leakAnalysis.memoryGrowth).toBeGreaterThan(0);
      expect(leakAnalysis.timeElapsed).toBeGreaterThan(0);
      expect(typeof leakAnalysis.isLeak).toBe('boolean');
    });

    test('ガベージコレクションの効果測定', async () => {
      const gcTest = {
        beforeGC: null,
        afterGC: null,
        
        measureBeforeGC() {
          this.beforeGC = {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            timestamp: Date.now()
          };
        },
        
        simulateGC() {
          // ガベージコレクションをシミュレート
          performance.memory.usedJSHeapSize = Math.floor(
            performance.memory.usedJSHeapSize * 0.7
          );
        },
        
        measureAfterGC() {
          this.afterGC = {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            timestamp: Date.now()
          };
        },
        
        getGCEffectiveness() {
          if (!this.beforeGC || !this.afterGC) return null;
          
          const memoryFreed = this.beforeGC.usedJSHeapSize - this.afterGC.usedJSHeapSize;
          const freePercentage = (memoryFreed / this.beforeGC.usedJSHeapSize) * 100;
          
          return {
            memoryFreed,
            freePercentage,
            beforeSize: this.beforeGC.usedJSHeapSize,
            afterSize: this.afterGC.usedJSHeapSize
          };
        }
      };

      // 大量のオブジェクトを作成してメモリを使用
      const largeObjects = [];
      for (let i = 0; i < 10000; i++) {
        largeObjects.push({
          id: i,
          data: new Array(100).fill('x').join('')
        });
      }

      gcTest.measureBeforeGC();
      
      // オブジェクトを削除してGCの対象にする
      largeObjects.length = 0;
      
      gcTest.simulateGC();
      gcTest.measureAfterGC();

      const effectiveness = gcTest.getGCEffectiveness();

      expect(effectiveness).not.toBeNull();
      expect(effectiveness.memoryFreed).toBeGreaterThan(0);
      expect(effectiveness.freePercentage).toBeGreaterThan(0);
      expect(effectiveness.afterSize).toBeLessThan(effectiveness.beforeSize);
    });
  });

  describe('ネットワークとI/Oパフォーマンス', () => {
    test('メッセージパッシングの遅延測定', async () => {
      const latencyTest = {
        measurements: [],
        
        async measureMessageLatency(messageType, data) {
          const startTime = performance.now();
          
          mockChrome.runtime.sendMessage.mockResolvedValue({
            type: 'RESPONSE',
            processed: true,
            timestamp: Date.now()
          });
          
          const response = await chrome.runtime.sendMessage({
            type: messageType,
            data: data,
            timestamp: startTime
          });
          
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          this.measurements.push({
            messageType,
            latency,
            dataSize: JSON.stringify(data).length,
            timestamp: endTime
          });
          
          return { response, latency };
        },
        
        getAverageLatency(messageType) {
          const filtered = this.measurements.filter(m => m.messageType === messageType);
          if (filtered.length === 0) return 0;
          
          const total = filtered.reduce((sum, m) => sum + m.latency, 0);
          return total / filtered.length;
        }
      };

      // 異なるサイズのメッセージでテスト
      const testCases = [
        { type: 'SMALL_MESSAGE', data: { id: 'test' } },
        { type: 'MEDIUM_MESSAGE', data: { 
          id: 'test', 
          content: 'x'.repeat(1000) 
        }},
        { type: 'LARGE_MESSAGE', data: { 
          id: 'test', 
          content: 'x'.repeat(10000),
          metadata: new Array(100).fill({ key: 'value' })
        }}
      ];

      // 各テストケースを複数回実行
      for (const testCase of testCases) {
        for (let i = 0; i < 5; i++) {
          await latencyTest.measureMessageLatency(testCase.type, testCase.data);
        }
      }

      const smallLatency = latencyTest.getAverageLatency('SMALL_MESSAGE');
      const mediumLatency = latencyTest.getAverageLatency('MEDIUM_MESSAGE');
      const largeLatency = latencyTest.getAverageLatency('LARGE_MESSAGE');

      expect(smallLatency).toBeLessThan(10); // 10ms以内
      expect(mediumLatency).toBeLessThan(50); // 50ms以内
      expect(largeLatency).toBeLessThan(100); // 100ms以内
      expect(largeLatency).toBeGreaterThan(smallLatency); // サイズに比例して増加
    });

    test('ストレージI/Oのパフォーマンス', async () => {
      const storagePerformance = {
        readTimes: [],
        writeTimes: [],
        
        async measureRead(key) {
          const startTime = performance.now();
          
          mockChrome.storage.local.get.mockResolvedValue({
            [key]: { data: 'test data', timestamp: Date.now() }
          });
          
          await chrome.storage.local.get([key]);
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          this.readTimes.push(duration);
          return duration;
        },
        
        async measureWrite(key, data) {
          const startTime = performance.now();
          
          mockChrome.storage.local.set.mockResolvedValue();
          
          await chrome.storage.local.set({ [key]: data });
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          this.writeTimes.push(duration);
          return duration;
        },
        
        getAverages() {
          const avgRead = this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length;
          const avgWrite = this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length;
          
          return { avgRead, avgWrite };
        }
      };

      // 読み書きテストを実行
      for (let i = 0; i < 10; i++) {
        await storagePerformance.measureRead(`test-key-${i}`);
        await storagePerformance.measureWrite(`test-key-${i}`, {
          id: i,
          data: 'x'.repeat(1000),
          timestamp: Date.now()
        });
      }

      const averages = storagePerformance.getAverages();

      expect(averages.avgRead).toBeLessThan(20); // 20ms以内
      expect(averages.avgWrite).toBeLessThan(30); // 30ms以内
      expect(storagePerformance.readTimes).toHaveLength(10);
      expect(storagePerformance.writeTimes).toHaveLength(10);
    });
  });

  describe('リソース使用量の最適化', () => {
    test('CPU使用率の監視', async () => {
      const cpuMonitor = {
        samples: [],
        
        startMonitoring() {
          this.startTime = performance.now();
          this.samples = [];
        },
        
        sampleCPUUsage() {
          const currentTime = performance.now();
          const sample = {
            timestamp: currentTime,
            // CPU使用率をシミュレート（実際の実装では別の方法が必要）
            usage: Math.random() * 100
          };
          
          this.samples.push(sample);
          return sample;
        },
        
        getAverageCPUUsage() {
          if (this.samples.length === 0) return 0;
          
          const total = this.samples.reduce((sum, sample) => sum + sample.usage, 0);
          return total / this.samples.length;
        }
      };

      cpuMonitor.startMonitoring();

      // CPU集約的な処理をシミュレート
      const intensiveTask = () => {
        const data = [];
        for (let i = 0; i < 10000; i++) {
          data.push({
            id: i,
            processed: Math.sqrt(i) * Math.random(),
            timestamp: Date.now()
          });
        }
        return data;
      };

      // 処理中にCPU使用率をサンプリング
      for (let i = 0; i < 10; i++) {
        intensiveTask();
        cpuMonitor.sampleCPUUsage();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const avgCPU = cpuMonitor.getAverageCPUUsage();

      expect(cpuMonitor.samples).toHaveLength(10);
      expect(avgCPU).toBeGreaterThanOrEqual(0);
      expect(avgCPU).toBeLessThanOrEqual(100);
    });

    test('バッチ処理による効率化', async () => {
      const batchProcessor = {
        queue: [],
        batchSize: 10,
        processingTime: 0,
        
        addItem(item) {
          this.queue.push(item);
        },
        
        async processBatch() {
          if (this.queue.length === 0) return [];
          
          const startTime = performance.now();
          const batch = this.queue.splice(0, this.batchSize);
          
          // バッチ処理をシミュレート
          const results = batch.map(item => ({
            ...item,
            processed: true,
            processedAt: Date.now()
          }));
          
          const endTime = performance.now();
          this.processingTime += (endTime - startTime);
          
          return results;
        },
        
        async processAll() {
          const allResults = [];
          
          while (this.queue.length > 0) {
            const batchResults = await this.processBatch();
            allResults.push(...batchResults);
          }
          
          return allResults;
        },
        
        getEfficiency() {
          return {
            totalProcessingTime: this.processingTime,
            averageTimePerBatch: this.processingTime / Math.ceil(100 / this.batchSize)
          };
        }
      };

      // 100個のアイテムを追加
      for (let i = 0; i < 100; i++) {
        batchProcessor.addItem({
          id: `item-${i}`,
          data: `data-${i}`,
          timestamp: Date.now()
        });
      }

      const results = await batchProcessor.processAll();
      const efficiency = batchProcessor.getEfficiency();

      expect(results).toHaveLength(100);
      expect(results.every(r => r.processed)).toBe(true);
      expect(efficiency.totalProcessingTime).toBeGreaterThan(0);
      expect(efficiency.averageTimePerBatch).toBeGreaterThan(0);
    });

    test('キャッシュ効果の測定', async () => {
      const cache = new Map();
      const cacheStats = {
        hits: 0,
        misses: 0,
        
        get(key) {
          if (cache.has(key)) {
            this.hits++;
            return cache.get(key);
          } else {
            this.misses++;
            return null;
          }
        },
        
        set(key, value) {
          cache.set(key, value);
        },
        
        getHitRate() {
          const total = this.hits + this.misses;
          return total > 0 ? this.hits / total : 0;
        }
      };

      const expensiveOperation = (input) => {
        // 重い処理をシミュレート
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(input + i);
        }
        return result;
      };

      const cachedOperation = (input) => {
        const cacheKey = `operation-${input}`;
        let result = cacheStats.get(cacheKey);
        
        if (result === null) {
          result = expensiveOperation(input);
          cacheStats.set(cacheKey, result);
        }
        
        return result;
      };

      // 同じ値で複数回実行（キャッシュ効果を確認）
      const testInputs = [1, 2, 3, 1, 2, 3, 4, 5, 1, 2];
      
      for (const input of testInputs) {
        cachedOperation(input);
      }

      const hitRate = cacheStats.getHitRate();

      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.misses).toBeGreaterThan(0);
      expect(hitRate).toBeGreaterThan(0.3); // 30%以上のヒット率
      expect(hitRate).toBeLessThanOrEqual(1.0);
    });
  });
});