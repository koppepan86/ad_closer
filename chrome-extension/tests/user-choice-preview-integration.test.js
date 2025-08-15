/**
 * UserChoiceDialog プレビュー統合機能のテスト
 */

describe('UserChoiceDialog Preview Integration', () => {
  let userChoiceDialog;
  let mockAdPreviewCapture;
  let mockPreviewGallery;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = '';
    
    // モックコンポーネントを作成
    mockAdPreviewCapture = {
      waitForInit: jest.fn().mockResolvedValue(),
      captureElement: jest.fn().mockResolvedValue({
        id: 'test-preview',
        screenshot: {
          thumbnail: 'data:image/png;base64,test-thumbnail',
          fullSize: 'data:image/png;base64,test-fullsize'
        },
        elementInfo: {
          tagName: 'DIV',
          size: { width: 300, height: 200 }
        }
      }),
      generateFallbackPreview: jest.fn().mockReturnValue({
        id: 'test-fallback',
        fallback: {
          reason: 'No element',
          description: 'Fallback preview'
        }
      }),
      cleanup: jest.fn()
    };

    mockPreviewGallery = {
      renderPreviews: jest.fn().mockResolvedValue(document.createElement('div')),
      handleIndividualSelection: jest.fn(),
      previewData: new Map([
        ['preview1', { id: 'preview1' }],
        ['preview2', { id: 'preview2' }]
      ]),
      cleanup: jest.fn()
    };

    // グローバルクラスをモック
    global.AdPreviewCapture = jest.fn().mockImplementation(() => mockAdPreviewCapture);
    global.PreviewGallery = jest.fn().mockImplementation(() => mockPreviewGallery);

    // UserChoiceDialogインスタンスを作成
    userChoiceDialog = new UserChoiceDialog();
  });

  afterEach(() => {
    if (userChoiceDialog) {
      userChoiceDialog.cleanup();
    }
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    test('プレビューコンポーネントが正しく初期化される', () => {
      expect(global.PreviewGallery).toHaveBeenCalledWith({
        enableIndividualSelection: true,
        showElementInfo: true,
        debugMode: false,
        onIndividualSelection: expect.any(Function)
      });

      expect(global.AdPreviewCapture).toHaveBeenCalledWith({
        debugMode: false
      });

      expect(userChoiceDialog.previewGallery).toBe(mockPreviewGallery);
      expect(userChoiceDialog.adPreviewCapture).toBe(mockAdPreviewCapture);
    });

    test('コンポーネントが利用できない場合でもエラーにならない', () => {
      // グローバルクラスを削除
      delete global.AdPreviewCapture;
      delete global.PreviewGallery;

      expect(() => {
        const dialog = new UserChoiceDialog();
        dialog.cleanup();
      }).not.toThrow();
    });
  });

  describe('プレビュー生成', () => {
    test('正常な広告要素のプレビューが生成される', async () => {
      const mockElement = document.createElement('div');
      const detectedAds = [{
        element: mockElement,
        type: 'banner',
        id: 'test-ad'
      }];

      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);

      // プレビュー生成を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAdPreviewCapture.waitForInit).toHaveBeenCalled();
      expect(mockAdPreviewCapture.captureElement).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          id: 'ad_0',
          type: 'banner'
        })
      );

      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });

    test('要素がない場合はフォールバックプレビューが生成される', async () => {
      const detectedAds = [{
        element: null,
        type: 'unknown',
        id: 'test-ad'
      }];

      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);

      // プレビュー生成を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAdPreviewCapture.generateFallbackPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ad_0',
          type: 'unknown'
        })
      );

      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });

    test('プレビュー生成エラー時はフォールバック表示される', async () => {
      // captureElementがエラーを投げるように設定
      mockAdPreviewCapture.captureElement.mockRejectedValue(new Error('Capture failed'));

      const mockElement = document.createElement('div');
      const detectedAds = [{
        element: mockElement,
        type: 'banner',
        id: 'test-ad'
      }];

      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);

      // プレビュー生成を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAdPreviewCapture.generateFallbackPreview).toHaveBeenCalled();

      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });
  });

  describe('個別選択機能', () => {
    test('プレビューの個別選択が正しく処理される', () => {
      const mockPreviewData = {
        id: 'test-preview',
        type: 'banner'
      };

      // 個別選択ハンドラーを呼び出し
      userChoiceDialog.handlePreviewSelection(mockPreviewData, 'block', 'none');

      // アクティブなダイアログがある場合の処理をテスト
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        individualSelections: new Map()
      });

      userChoiceDialog.handlePreviewSelection(mockPreviewData, 'allow', 'none');

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.individualSelections.get('test-preview')).toBe('allow');
    });

    test('一括操作が正しく処理される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        individualSelections: new Map()
      });

      userChoiceDialog.handleBulkAction(dialogId, 'block');

      expect(mockPreviewGallery.handleIndividualSelection).toHaveBeenCalledWith('preview1', 'block');
      expect(mockPreviewGallery.handleIndividualSelection).toHaveBeenCalledWith('preview2', 'block');
    });
  });

  describe('ユーザー選択処理', () => {
    test('個別選択がある場合は個別選択が優先される', async () => {
      const dialogId = 'test-dialog';
      const mockResolve = jest.fn();
      const detectedAds = [{ type: 'banner' }];
      const individualSelections = new Map([
        ['preview1', 'allow'],
        ['preview2', 'block']
      ]);

      userChoiceDialog.activeDialogs.set(dialogId, {
        overlay: document.createElement('div'),
        resolve: mockResolve,
        detectedAds,
        individualSelections,
        startTime: Date.now()
      });

      // チェックボックス要素を作成
      const rememberCheckbox = document.createElement('input');
      rememberCheckbox.type = 'checkbox';
      rememberCheckbox.id = `remember-choice-${dialogId}`;
      rememberCheckbox.checked = true;
      document.body.appendChild(rememberCheckbox);

      const autoBlockCheckbox = document.createElement('input');
      autoBlockCheckbox.type = 'checkbox';
      autoBlockCheckbox.id = `auto-block-${dialogId}`;
      autoBlockCheckbox.checked = false;
      document.body.appendChild(autoBlockCheckbox);

      await userChoiceDialog.handleUserChoice(dialogId, 'allow');

      expect(mockResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'individual',
          individualChoices: {
            'preview1': 'allow',
            'preview2': 'block'
          },
          options: {
            rememberChoice: true,
            autoBlock: false
          }
        })
      );
    });

    test('個別選択がない場合は全体アクションが使用される', async () => {
      const dialogId = 'test-dialog';
      const mockResolve = jest.fn();
      const detectedAds = [{ type: 'banner' }];

      userChoiceDialog.activeDialogs.set(dialogId, {
        overlay: document.createElement('div'),
        resolve: mockResolve,
        detectedAds,
        individualSelections: new Map(),
        startTime: Date.now()
      });

      // チェックボックス要素を作成
      const rememberCheckbox = document.createElement('input');
      rememberCheckbox.type = 'checkbox';
      rememberCheckbox.id = `remember-choice-${dialogId}`;
      document.body.appendChild(rememberCheckbox);

      const autoBlockCheckbox = document.createElement('input');
      autoBlockCheckbox.type = 'checkbox';
      autoBlockCheckbox.id = `auto-block-${dialogId}`;
      document.body.appendChild(autoBlockCheckbox);

      await userChoiceDialog.handleUserChoice(dialogId, 'block');

      expect(mockResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'block',
          individualChoices: {}
        })
      );
    });
  });

  describe('UI要素', () => {
    test('プレビューコンテナが正しく作成される', async () => {
      const detectedAds = [{
        element: document.createElement('div'),
        type: 'banner'
      }];

      const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);

      // DOM要素の確認
      await new Promise(resolve => setTimeout(resolve, 50));

      const previewContainer = document.querySelector('.ad-choice-preview-container');
      expect(previewContainer).toBeTruthy();

      const loadingElement = document.querySelector('.ad-choice-preview-loading');
      expect(loadingElement).toBeTruthy();

      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });

    test('一括操作ボタンが正しく作成される', () => {
      const container = document.createElement('div');
      userChoiceDialog.addBulkActions('test-dialog', container);

      const bulkActions = container.querySelector('.ad-choice-bulk-actions');
      expect(bulkActions).toBeTruthy();

      const allowButton = bulkActions.querySelector('[data-bulk-action="allow"]');
      const blockButton = bulkActions.querySelector('[data-bulk-action="block"]');
      
      expect(allowButton).toBeTruthy();
      expect(blockButton).toBeTruthy();
      expect(allowButton.textContent).toBe('すべて許可');
      expect(blockButton.textContent).toBe('すべてブロック');
    });
  });

  describe('クリーンアップ', () => {
    test('プレビューコンポーネントが正しくクリーンアップされる', () => {
      userChoiceDialog.cleanup();

      expect(mockPreviewGallery.cleanup).toHaveBeenCalled();
      expect(mockAdPreviewCapture.cleanup).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    test('AdPreviewCaptureが利用できない場合はフォールバック表示される', async () => {
      // AdPreviewCaptureを無効化
      userChoiceDialog.adPreviewCapture = null;

      const detectedAds = [{
        element: document.createElement('div'),
        type: 'banner'
      }];

      const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);

      // プレビュー生成を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      const errorElement = document.querySelector('.ad-choice-preview-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('プレビューを生成できませんでした');

      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });

    test('PreviewGalleryが利用できない場合でもエラーにならない', async () => {
      // PreviewGalleryを無効化
      userChoiceDialog.previewGallery = null;

      const detectedAds = [{
        element: document.createElement('div'),
        type: 'banner'
      }];

      expect(async () => {
        const dialogPromise = userChoiceDialog.showChoiceDialog(detectedAds);
        await new Promise(resolve => setTimeout(resolve, 100));
        userChoiceDialog.closeAllDialogs();
      }).not.toThrow();
    });
  });
});