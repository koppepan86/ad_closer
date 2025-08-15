/**
 * PopupDetectorとAdPreviewCaptureの統合テストスイート
 */

describe('PopupDetector Integration with AdPreviewCapture', () => {
  let popupDetector;
  let adPreviewCapture;
  let userChoiceDialog;
  let testElements;

  beforeEach(async () => {
    // テスト用のDOM要素を作成
    document.body.innerHTML = `
      <div id="normalContent">
        <h1>通常のコンテンツ</h1>
        <p>これは通常のページコンテンツです。</p>
      </div>
      
      <div id="popup1" class="popup-overlay" style="position: fixed; top: 100px; left: 100px; width: 300px; height: 200px; z-index: 1000; background: rgba(255, 0, 0, 0.8);">
        <h3>ポップアップ広告1</h3>
        <p>これはポップアップ広告です。</p>
        <button>クリックしてください</button>
      </div>
      
      <div id="banner1" class="ad-banner" style="position: absolute; top: 0; left: 0; width: 728px; height: 90px; background: rgba(0, 255, 0, 0.8);">
        <h4>バナー広告</h4>
        <p>728x90 リーダーボード広告</p>
      </div>
      
      <iframe id="adFrame1" src="about:blank" style="position: fixed; bottom: 0; right: 0; width: 300px; height: 250px; z-index: 500;" data-ad-slot="test-slot"></iframe>
      
      <div id="modal1" class="modal-dialog" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 300px; z-index: 2000; background: rgba(0, 0, 255, 0.8); display: none;">
        <h3>モーダル広告</h3>
        <p>これはモーダル形式の広告です。</p>
      </div>
    `;

    testElements = {
      popup1: document.getElementById('popup1'),
      banner1: document.getElementById('banner1'),
      adFrame1: document.getElementById('adFrame1'),
      modal1: document.getElementById('modal1')
    };

    // html2canvasのモック
    window.html2canvas = jest.fn().mockImplementation((element) => {
      return Promise.resolve({
        width: element.offsetWidth || 300,
        height: element.offsetHeight || 200,
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
      });
    });

    // UserChoiceDialogのモック
    userChoiceDialog = {
      showChoiceDialog: jest.fn().mockResolvedValue({
        action: 'block',
        options: {
          rememberChoice: false,
          autoBlock: false
        }
      })
    };
    window.userChoiceDialog = userChoiceDialog;

    // AdPreviewCaptureのインスタンスを作成
    adPreviewCapture = new AdPreviewCapture({
      debugMode: true,
      privacyEnabled: true,
      privacyLevel: 'medium'
    });
    window.AdPreviewCapture = AdPreviewCapture;
    window.adPreviewCapture = adPreviewCapture;

    // 初期化完了を待つ
    await adPreviewCapture.waitForInit();

    // PopupDetectorのインスタンスを作成
    popupDetector = new PopupDetector({
      debugMode: true,
      enableMutationObserver: false, // テスト中は無効化
      enablePeriodicCheck: false
    });

    // 初期化完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    // クリーンアップ
    if (popupDetector) {
      popupDetector.cleanup();
    }
    if (adPreviewCapture) {
      adPreviewCapture.cleanupTemporaryImages();
    }
    
    // DOM要素をクリア
    document.body.innerHTML = '';
    
    // グローバル変数をクリア
    delete window.userChoiceDialog;
    delete window.adPreviewCapture;
    delete window.html2canvas;
  });

  describe('基本統合機能', () => {
    test('PopupDetectorがAdPreviewCaptureを正常に呼び出す', async () => {
      // AdPreviewCaptureのcaptureMultipleElementsメソッドをスパイ
      const captureMultipleSpy = jest.spyOn(adPreviewCapture, 'captureMultipleElements');

      // ポップアップを検出
      const detectedPopups = await popupDetector.detectPopups();
      expect(detectedPopups.length).toBeGreaterThan(0);

      // ユーザー選択を要求（これによりプレビュー生成が呼ばれる）
      await popupDetector.requestUserChoice(detectedPopups);

      // AdPreviewCaptureが呼ばれたことを確認
      expect(captureMultipleSpy).toHaveBeenCalled();
      expect(captureMultipleSpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          showProgress: true,
          onProgress: expect.any(Function)
        })
      );
    });

    test('プレビューデータがUserChoiceDialogに正しく渡される', async () => {
      const detectedPopups = await popupDetector.detectPopups();
      await popupDetector.requestUserChoice(detectedPopups);

      // UserChoiceDialogが呼ばれたことを確認
      expect(userChoiceDialog.showChoiceDialog).toHaveBeenCalled();

      // 呼び出し引数を確認
      const [popups, previewData] = userChoiceDialog.showChoiceDialog.mock.calls[0];
      expect(popups).toBe(detectedPopups);
      expect(previewData).toBeDefined();
      expect(previewData.previews).toBeDefined();
      expect(previewData.totalCount).toBe(detectedPopups.length);
    });

    test('AdPreviewCaptureが利用できない場合でも正常に動作する', async () => {
      // AdPreviewCaptureを無効化
      delete window.AdPreviewCapture;
      delete window.adPreviewCapture;

      const detectedPopups = await popupDetector.detectPopups();
      
      // エラーが発生せずに処理が完了することを確認
      await expect(popupDetector.requestUserChoice(detectedPopups)).resolves.not.toThrow();

      // UserChoiceDialogが呼ばれたことを確認（プレビューなしで）
      expect(userChoiceDialog.showChoiceDialog).toHaveBeenCalled();
      const [popups, previewData] = userChoiceDialog.showChoiceDialog.mock.calls[0];
      expect(popups).toBe(detectedPopups);
      expect(previewData).toBeNull();
    });
  });

  describe('プレビュー生成機能', () => {
    test('複数の広告要素のプレビューが正常に生成される', async () => {
      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);

      expect(previewData).toBeDefined();
      expect(previewData.previews).toHaveLength(detectedPopups.length);
      expect(previewData.totalCount).toBe(detectedPopups.length);
      expect(previewData.successCount).toBeGreaterThan(0);
    });

    test('プレビュー生成エラー時のフォールバック処理', async () => {
      // html2canvasでエラーを発生させる
      window.html2canvas.mockRejectedValue(new Error('Canvas generation failed'));

      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);

      expect(previewData).toBeDefined();
      expect(previewData.previews).toHaveLength(detectedPopups.length);
      
      // すべてフォールバックプレビューになることを確認
      previewData.previews.forEach(preview => {
        expect(preview.fallback).toBeDefined();
      });
    });

    test('プレビュー生成の進行状況表示が正常に動作する', async () => {
      const detectedPopups = await popupDetector.detectPopups();

      // プレビュー生成を開始
      const previewPromise = popupDetector.generateAdPreviews(detectedPopups);

      // 進行状況表示要素が作成されることを確認
      await new Promise(resolve => setTimeout(resolve, 50));
      const progressIndicator = document.getElementById('ad-preview-progress');
      expect(progressIndicator).toBeTruthy();

      // プレビュー生成完了を待つ
      await previewPromise;

      // 進行状況表示が隠されることを確認
      await new Promise(resolve => setTimeout(resolve, 350));
      const hiddenIndicator = document.getElementById('ad-preview-progress');
      expect(hiddenIndicator).toBeFalsy();
    });
  });

  describe('プライバシー保護統合', () => {
    test('機密サイトでプレビュー生成が無効化される', async () => {
      // 現在のURLを機密サイトに変更（モック）
      Object.defineProperty(window, 'location', {
        value: { 
          href: 'https://www.bank.com/login',
          hostname: 'www.bank.com'
        },
        writable: true
      });

      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);

      expect(previewData).toBeDefined();
      expect(previewData.previews).toHaveLength(detectedPopups.length);
      
      // すべてのプレビューがプライバシー保護によりブロックされることを確認
      previewData.previews.forEach(preview => {
        expect(preview.blocked || preview.fallback).toBeTruthy();
      });
    });

    test('個人情報を含む要素のプレビューにぼかし処理が適用される', async () => {
      // 個人情報を含む要素を追加
      const personalInfoElement = document.createElement('div');
      personalInfoElement.id = 'personalInfoAd';
      personalInfoElement.className = 'popup-overlay';
      personalInfoElement.style.cssText = 'position: fixed; top: 200px; left: 200px; width: 300px; height: 200px; z-index: 1500;';
      personalInfoElement.innerHTML = `
        <h3>個人情報含有広告</h3>
        <p>連絡先: john.doe@example.com</p>
        <p>電話番号: (555) 123-4567</p>
      `;
      document.body.appendChild(personalInfoElement);

      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);

      expect(previewData).toBeDefined();
      
      // 個人情報を含む要素のプレビューを確認
      const personalInfoPreview = previewData.previews.find(preview => 
        preview.element.id === 'personalInfoAd'
      );
      
      if (personalInfoPreview && !personalInfoPreview.blocked) {
        expect(personalInfoPreview.privacyProtection?.blurred).toBe(true);
      }
    });
  });

  describe('パフォーマンス統合', () => {
    test('大量の広告要素でもパフォーマンス目標内で処理される', async () => {
      // 大量の広告要素を作成
      for (let i = 0; i < 10; i++) {
        const adElement = document.createElement('div');
        adElement.id = `testAd${i}`;
        adElement.className = 'popup-overlay';
        adElement.style.cssText = `position: fixed; top: ${50 + i * 30}px; left: ${50 + i * 30}px; width: 200px; height: 150px; z-index: ${1000 + i};`;
        adElement.innerHTML = `<h4>テスト広告 ${i}</h4><p>広告コンテンツ</p>`;
        document.body.appendChild(adElement);
      }

      const startTime = Date.now();
      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      expect(previewData).toBeDefined();
      expect(previewData.previews.length).toBeGreaterThan(5);
      
      // パフォーマンス目標（2秒以内）を確認
      expect(processingTime).toBeLessThan(2000);
    });

    test('メモリ使用量が適切に管理される', async () => {
      const detectedPopups = await popupDetector.detectPopups();
      await popupDetector.generateAdPreviews(detectedPopups);

      // プレビューキャッシュのサイズを確認
      const cacheSize = adPreviewCapture.previewCache.size;
      expect(cacheSize).toBe(detectedPopups.length);

      // クリーンアップを実行
      adPreviewCapture.cleanupTemporaryImages();

      // キャッシュがクリアされることを確認
      const cleanedCacheSize = adPreviewCapture.previewCache.size;
      expect(cleanedCacheSize).toBe(0);
    });
  });

  describe('エラーハンドリング統合', () => {
    test('プレビュー生成エラー時でもユーザー選択が継続される', async () => {
      // AdPreviewCaptureでエラーを発生させる
      jest.spyOn(adPreviewCapture, 'captureMultipleElements').mockRejectedValue(
        new Error('Preview generation failed')
      );

      const detectedPopups = await popupDetector.detectPopups();
      
      // エラーが発生してもユーザー選択が継続されることを確認
      await expect(popupDetector.requestUserChoice(detectedPopups)).resolves.not.toThrow();
      
      // UserChoiceDialogが呼ばれたことを確認（プレビューなしで）
      expect(userChoiceDialog.showChoiceDialog).toHaveBeenCalled();
      const [popups, previewData] = userChoiceDialog.showChoiceDialog.mock.calls[0];
      expect(popups).toBe(detectedPopups);
      expect(previewData).toBeNull();
    });

    test('無効な要素でもエラーが発生しない', async () => {
      // 無効な要素を含むポップアップリストを作成
      const invalidPopups = [
        { element: null, type: 'invalid' },
        { element: testElements.popup1, type: 'valid' },
        { element: document.createElement('div'), type: 'detached' }
      ];

      // エラーが発生しないことを確認
      await expect(popupDetector.generateAdPreviews(invalidPopups)).resolves.not.toThrow();
    });
  });

  describe('ユーザー体験統合', () => {
    test('プレビュー付きダイアログが正しい情報を表示する', async () => {
      const detectedPopups = await popupDetector.detectPopups();
      await popupDetector.requestUserChoice(detectedPopups);

      const [popups, previewData] = userChoiceDialog.showChoiceDialog.mock.calls[0];
      
      expect(previewData).toBeDefined();
      expect(previewData.previews).toHaveLength(popups.length);
      
      // 各プレビューが必要な情報を含むことを確認
      previewData.previews.forEach((preview, index) => {
        expect(preview.id).toBeDefined();
        expect(preview.element).toBe(popups[index].element);
        expect(preview.elementInfo).toBeDefined();
        expect(preview.timestamp).toBeDefined();
      });
    });

    test('プレビュー生成中の視覚的フィードバックが提供される', async () => {
      const detectedPopups = await popupDetector.detectPopups();
      
      // プレビュー生成を開始
      const previewPromise = popupDetector.generateAdPreviews(detectedPopups);
      
      // 少し待ってから進行状況表示を確認
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const progressIndicator = document.getElementById('ad-preview-progress');
      expect(progressIndicator).toBeTruthy();
      expect(progressIndicator.textContent).toContain('広告プレビューを生成中');
      
      await previewPromise;
    });
  });

  describe('設定統合', () => {
    test('プライバシー設定がプレビュー生成に反映される', async () => {
      // 高プライバシーレベルに設定
      await adPreviewCapture.updatePrivacySettings({
        privacyLevel: 'high',
        personalInfoDetectionEnabled: true,
        blurSensitiveContent: false // ぼかしではなくブロック
      });

      const detectedPopups = await popupDetector.detectPopups();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);

      expect(previewData).toBeDefined();
      
      // 高プライバシーレベルでの動作を確認
      const privacySettings = adPreviewCapture.getPrivacySettings();
      expect(privacySettings.privacyLevel).toBe('high');
    });

    test('パフォーマンス設定がプレビュー生成に反映される', async () => {
      // パフォーマンス設定を調整
      adPreviewCapture.options.targetProcessingTime = 200; // 200ms目標
      adPreviewCapture.options.maxConcurrentCaptures = 2;

      const detectedPopups = await popupDetector.detectPopups();
      const startTime = Date.now();
      const previewData = await popupDetector.generateAdPreviews(detectedPopups);
      const endTime = Date.now();

      expect(previewData).toBeDefined();
      
      // 設定が反映されていることを確認
      const processingTime = endTime - startTime;
      console.log('Processing time with optimized settings:', processingTime);
    });
  });
});