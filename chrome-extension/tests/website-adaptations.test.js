/**
 * ウェブサイト固有適応システムのテスト
 */

describe('WebsiteAdaptationManager', () => {
    let adaptationManager;
    let mockChrome;

    beforeEach(() => {
        // Chrome API のモック
        mockChrome = {
            runtime: {
                sendMessage: jest.fn().mockResolvedValue({ success: true, data: null })
            }
        };
        global.chrome = mockChrome;

        // DOM のモック
        Object.defineProperty(window, 'location', {
            value: {
                hostname: 'example.com',
                href: 'https://example.com/test'
            },
            writable: true
        });

        // WebsiteAdaptationManager のインスタンスを作成
        adaptationManager = new WebsiteAdaptationManager();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('正常に初期化される', async () => {
            await adaptationManager.initialize();
            
            expect(adaptationManager.initialized).toBe(true);
            expect(adaptationManager.currentDomain).toBe('example.com');
            expect(adaptationManager.websiteType).toBeDefined();
        });

        test('ドメインルールが読み込まれる', async () => {
            mockChrome.runtime.sendMessage.mockResolvedValue({
                success: true,
                data: {
                    selectors: ['.test-modal'],
                    excludeSelectors: ['.test-exclude']
                }
            });

            await adaptationManager.initialize();
            
            expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'GET_DOMAIN_RULES',
                domain: 'example.com'
            });
        });
    });

    describe('ウェブサイトタイプ検出', () => {
        test('React アプリケーションを検出', async () => {
            // React の存在をシミュレート
            window.React = {};
            document.body.innerHTML = '<div data-reactroot></div>';

            await adaptationManager.initialize();
            
            expect(adaptationManager.websiteType).toContain('react');
        });

        test('Vue アプリケーションを検出', async () => {
            // Vue の存在をシミュレート
            window.Vue = {};
            document.body.innerHTML = '<div data-server-rendered="true"></div>';

            await adaptationManager.initialize();
            
            expect(adaptationManager.websiteType).toContain('vue');
        });

        test('静的サイトを検出', async () => {
            // フレームワークの痕跡を削除
            delete window.React;
            delete window.Vue;
            delete window.ng;
            document.body.innerHTML = '<div>Static content</div>';

            await adaptationManager.initialize();
            
            expect(adaptationManager.websiteType).toBe('static');
        });
    });

    describe('ドメイン固有検出', () => {
        beforeEach(async () => {
            // テスト用のドメインルールを設定
            adaptationManager.domainRules.set('example.com', {
                selectors: ['.test-popup', '.test-modal'],
                excludeSelectors: ['.test-exclude'],
                characteristics: {
                    minWidth: 200,
                    minHeight: 100,
                    hasCloseButton: true
                }
            });
            await adaptationManager.initialize();
        });

        test('ドメイン固有セレクターで要素を検出', () => {
            document.body.innerHTML = `
                <div class="test-popup" style="width: 300px; height: 200px; position: fixed;">
                    <button class="close">×</button>
                    Test popup
                </div>
            `;

            const detected = adaptationManager.detectDomainSpecificPopups();
            
            expect(detected).toHaveLength(1);
            expect(detected[0].className).toBe('test-popup');
        });

        test('除外セレクターで要素を除外', () => {
            document.body.innerHTML = `
                <div class="test-popup test-exclude" style="width: 300px; height: 200px;">
                    Test popup
                </div>
            `;

            const detected = adaptationManager.detectDomainSpecificPopups();
            
            expect(detected).toHaveLength(0);
        });

        test('特性検証で不適切な要素を除外', () => {
            document.body.innerHTML = `
                <div class="test-popup" style="width: 50px; height: 50px;">
                    Too small
                </div>
            `;

            const detected = adaptationManager.detectDomainSpecificPopups();
            
            expect(detected).toHaveLength(0);
        });
    });

    describe('ウェブサイトカテゴリ分類', () => {
        test('ニュースサイトを分類', () => {
            const category = adaptationManager.categorizeWebsite('news.example.com');
            expect(category).toBe('news');
        });

        test('ECサイトを分類', () => {
            const category = adaptationManager.categorizeWebsite('shop.example.com');
            expect(category).toBe('ecommerce');
        });

        test('ソーシャルメディアを分類', () => {
            const category = adaptationManager.categorizeWebsite('twitter.com');
            expect(category).toBe('social');
        });

        test('一般サイトを分類', () => {
            const category = adaptationManager.categorizeWebsite('unknown.example.com');
            expect(category).toBe('general');
        });
    });

    describe('統計情報', () => {
        test('適応統計を取得', async () => {
            await adaptationManager.initialize();
            
            const stats = adaptationManager.getAdaptationStatistics();
            
            expect(stats).toHaveProperty('domain');
            expect(stats).toHaveProperty('websiteType');
            expect(stats).toHaveProperty('rulesCount');
            expect(stats).toHaveProperty('adaptiveLearning');
            expect(stats).toHaveProperty('spaHandler');
            expect(stats).toHaveProperty('performanceOptimizer');
        });
    });
});

describe('AdaptiveLearningSystem', () => {
    let learningSystem;
    let mockChrome;

    beforeEach(() => {
        mockChrome = {
            runtime: {
                sendMessage: jest.fn().mockResolvedValue({ success: true, data: null })
            }
        };
        global.chrome = mockChrome;

        learningSystem = new AdaptiveLearningSystem();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('正常に初期化される', async () => {
            await learningSystem.initialize('example.com');
            
            expect(learningSystem.initialized).toBe(true);
            expect(learningSystem.domain).toBe('example.com');
        });

        test('既存の学習データを読み込む', async () => {
            const mockData = {
                patterns: {
                    'pattern1': { occurrences: 5, confidence: 0.8 }
                },
                history: [{ patternId: 'pattern1', timestamp: Date.now() }]
            };

            mockChrome.runtime.sendMessage.mockResolvedValue({
                success: true,
                data: mockData
            });

            await learningSystem.initialize('example.com');
            
            expect(learningSystem.learningData.size).toBe(1);
            expect(learningSystem.patternHistory).toHaveLength(1);
        });
    });

    describe('特徴抽出', () => {
        test('要素の特徴を正しく抽出', () => {
            document.body.innerHTML = `
                <div id="test-popup" class="modal-popup" 
                     style="position: fixed; z-index: 1000; width: 300px; height: 200px;">
                    <button>Close</button>
                    <p>Test content</p>
                </div>
            `;

            const element = document.getElementById('test-popup');
            const features = learningSystem.extractFeatures(element);
            
            expect(features).toHaveProperty('position', 'fixed');
            expect(features).toHaveProperty('zIndex', 1000);
            expect(features).toHaveProperty('width', 300);
            expect(features).toHaveProperty('height', 200);
            expect(features).toHaveProperty('tagName', 'DIV');
            expect(features).toHaveProperty('className', 'modal-popup');
            expect(features).toHaveProperty('id', 'test-popup');
            expect(features).toHaveProperty('hasButtons', true);
        });
    });

    describe('パターン生成', () => {
        test('特徴からパターンを生成', () => {
            const features = {
                tagName: 'DIV',
                position: 'fixed',
                width: 300,
                height: 200,
                zIndex: 1000,
                hasButtons: true,
                timestamp: Date.now()
            };

            const pattern = learningSystem.generatePattern(features);
            
            expect(pattern).toHaveProperty('id');
            expect(pattern).toHaveProperty('positionType');
            expect(pattern).toHaveProperty('sizeCategory');
            expect(pattern).toHaveProperty('styleSignature');
            expect(pattern).toHaveProperty('contentType');
            expect(pattern).toHaveProperty('behaviorType');
        });
    });

    describe('予測', () => {
        beforeEach(async () => {
            await learningSystem.initialize('example.com');
        });

        test('データ不足時は不明を返す', () => {
            const pattern = { id: 'unknown-pattern' };
            const prediction = learningSystem.predictPopupType(pattern);
            
            expect(prediction.type).toBe('unknown');
            expect(prediction.confidence).toBe(0.1);
            expect(prediction.reason).toBe('insufficient_data');
        });

        test('ユーザー履歴から予測', async () => {
            const patternId = 'test-pattern';
            const pattern = { id: patternId };
            
            // 学習データを設定
            learningSystem.learningData.set(patternId, {
                pattern: pattern,
                occurrences: 5,
                userDecisions: ['close', 'close', 'close', 'keep'],
                confidence: 0.75
            });

            const prediction = learningSystem.predictPopupType(pattern);
            
            expect(prediction.type).toBe('likely_ad');
            expect(prediction.confidence).toBeGreaterThan(0.7);
            expect(prediction.reason).toBe('user_history');
        });
    });

    describe('学習', () => {
        beforeEach(async () => {
            await learningSystem.initialize('example.com');
        });

        test('ユーザー決定から学習', async () => {
            const patternId = 'test-pattern';
            
            // 初期データを設定
            learningSystem.learningData.set(patternId, {
                pattern: { id: patternId },
                occurrences: 1,
                userDecisions: [],
                confidence: 0
            });

            await learningSystem.learnFromUserDecision(patternId, 'close');
            
            const data = learningSystem.learningData.get(patternId);
            expect(data.userDecisions).toContain('close');
            expect(data.confidence).toBe(1); // 100% close rate
        });
    });

    describe('統計', () => {
        test('学習統計を取得', async () => {
            await learningSystem.initialize('example.com');
            
            const stats = learningSystem.getStatistics();
            
            expect(stats).toHaveProperty('domain', 'example.com');
            expect(stats).toHaveProperty('patternsCount');
            expect(stats).toHaveProperty('totalOccurrences');
            expect(stats).toHaveProperty('historyLength');
            expect(stats).toHaveProperty('averageConfidence');
            expect(stats).toHaveProperty('initialized', true);
        });
    });
});

describe('統合テスト', () => {
    test('WebsiteAdaptationManager と AdaptiveLearningSystem の連携', async () => {
        const mockChrome = {
            runtime: {
                sendMessage: jest.fn().mockResolvedValue({ success: true, data: null })
            }
        };
        global.chrome = mockChrome;

        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.com' },
            writable: true
        });

        const manager = new WebsiteAdaptationManager();
        await manager.initialize();

        // テスト要素を作成
        document.body.innerHTML = `
            <div class="test-popup" style="position: fixed; z-index: 1000; width: 300px; height: 200px;">
                <button class="close">×</button>
                Test popup content
            </div>
        `;

        const element = document.querySelector('.test-popup');
        const learningResult = await manager.applyAdaptiveLearning(element);

        expect(learningResult).toBeDefined();
        expect(learningResult).toHaveProperty('features');
        expect(learningResult).toHaveProperty('pattern');
        expect(learningResult).toHaveProperty('prediction');
        expect(learningResult).toHaveProperty('confidence');
    });
});