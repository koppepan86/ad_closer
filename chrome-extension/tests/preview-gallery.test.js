/**
 * PreviewGallery クラスのユニットテスト
 */

// PreviewGalleryクラスをインポート
const fs = require('fs');
const path = require('path');

// PreviewGalleryクラスを読み込み
const previewGalleryPath = path.join(__dirname, '../content/preview-gallery.js');
const previewGalleryCode = fs.readFileSync(previewGalleryPath, 'utf8');

// グローバルスコープでPreviewGalleryクラスを評価
eval(previewGalleryCode);

describe('PreviewGallery', () => {
  let previewGallery;
  let mockContainer;
  let mockPreviewData;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = '';
    
    // モックコンテナを作成
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-container';
    document.body.appendChild(mockContainer);

    // モックプレビューデータを作成
    mockPreviewData = [
      {
        id: 'preview_1',
        element: document.createElement('div'),
        screenshot: {
          thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==',
          thumbnailFormat: 'png',
          thumbnailSize: { width: 150, height: 100 },
          fullSize: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==',
          fullSizeFormat: 'png',
          fullSizeSize: { width: 400, height: 300 },
          original: { width: 320, height: 240 }
        },
        elementInfo: {
          tagName: 'DIV',
          className: 'test-ad overlay-ad',
          id: 'ad-1',
          position: { x: 100, y: 200 },
          size: { width: 320, height: 240 },
          zIndex: 1000,
          type: 'オーバーレイ広告'
        },
        captureTime: 150,
        timestamp: Date.now()
      },
      {
        id: 'preview_2',
        element: document.createElement('iframe'),
        screenshot: null,
        elementInfo: {
          tagName: 'IFRAME',
          className: 'banner-ad',
          id: 'ad-2',
          position: { x: 0, y: 0 },
          size: { width: 728, height: 90 },
          zIndex: 'auto',
          type: 'バナー広告'
        },
        fallback: {
          reason: 'capture_failed',
          description: 'スクリーンショットの取得に失敗しました'
        },
        captureTime: 0,
        timestamp: Date.now()
      }
    ];

    // PreviewGalleryインスタンスを作成
    previewGallery = new PreviewGallery({
      debugMode: false,
      showElementInfo: true,
      enableIndividualSelection: true,
      enableExpandedView: true
    });
  });

  afterEach(() => {
    if (previewGallery) {
      previewGallery.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('初期化', () => {
    test('正常に初期化される', () => {
      expect(previewGallery).toBeDefined();
      expect(previewGallery.initialized).toBe(true);
    });

    test('デフォルトオプションが設定される', () => {
      const gallery = new PreviewGallery();
      expect(gallery.options.thumbnailWidth).toBe(300);
      expect(gallery.options.thumbnailHeight).toBe(200);
      expect(gallery.options.maxPreviewsPerRow).toBe(3);
      expect(gallery.options.enableExpandedView).toBe(true);
      expect(gallery.options.enableIndividualSelection).toBe(true);
    });

    test('カスタムオプションが適用される', () => {
      const customOptions = {
        thumbnailWidth: 200,
        thumbnailHeight: 150,
        enableExpandedView: false,
        debugMode: true
      };
      
      const gallery = new PreviewGallery(customOptions);
      expect(gallery.options.thumbnailWidth).toBe(200);
      expect(gallery.options.thumbnailHeight).toBe(150);
      expect(gallery.options.enableExpandedView).toBe(false);
      expect(gallery.options.debugMode).toBe(true);
    });

    test('スタイルが注入される', () => {
      const styleElement = document.getElementById('preview-gallery-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement.tagName).toBe('STYLE');
    });
  });

  describe('プレビュー描画', () => {
    test('プレビューが正常に描画される', async () => {
      const galleryElement = await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      expect(galleryElement).toBeTruthy();
      expect(galleryElement.classList.contains('preview-gallery')).toBe(true);
      expect(mockContainer.contains(galleryElement)).toBe(true);
    });

    test('プレビューアイテムが正しい数作成される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const previewItems = mockContainer.querySelectorAll('.preview-item');
      expect(previewItems.length).toBe(mockPreviewData.length);
    });

    test('ヘッダーが正しく表示される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const header = mockContainer.querySelector('.preview-gallery-header');
      const title = mockContainer.querySelector('.preview-gallery-title');
      const count = mockContainer.querySelector('.preview-count');
      
      expect(header).toBeTruthy();
      expect(title.textContent).toBe('検出された広告');
      expect(count.textContent).toBe(`${mockPreviewData.length}個`);
    });

    test('画像プレビューが正しく表示される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const previewImages = mockContainer.querySelectorAll('.preview-image');
      expect(previewImages.length).toBe(1); // スクリーンショットがあるのは1つだけ
      
      const firstImage = previewImages[0];
      expect(firstImage.src).toBe(mockPreviewData[0].screenshot.thumbnail);
      expect(firstImage.alt).toContain('オーバーレイ広告');
    });

    test('フォールバック表示が正しく動作する', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const fallbackElements = mockContainer.querySelectorAll('.preview-fallback');
      expect(fallbackElements.length).toBe(1); // フォールバックが必要なのは1つ
      
      const fallbackElement = fallbackElements[0];
      expect(fallbackElement.textContent).toContain('バナー広告');
    });

    test('要素情報が正しく表示される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const infoElements = mockContainer.querySelectorAll('.preview-info');
      expect(infoElements.length).toBe(mockPreviewData.length);
      
      const firstInfo = infoElements[0];
      const typeElement = firstInfo.querySelector('.preview-type');
      const sizeElement = firstInfo.querySelector('.preview-size');
      
      expect(typeElement.textContent).toBe('オーバーレイ広告');
      expect(sizeElement.textContent).toBe('320×240px');
    });

    test('無効なデータでエラーが発生する', async () => {
      await expect(previewGallery.renderPreviews(null, mockContainer))
        .rejects.toThrow('Preview data must be an array');
      
      await expect(previewGallery.renderPreviews(mockPreviewData, null))
        .rejects.toThrow('Container element is required');
    });
  });

  describe('個別選択機能', () => {
    beforeEach(async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
    });

    test('個別選択が正常に動作する', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.handleIndividualSelection(previewId, 'allow');
      expect(previewGallery.getPreviewState(previewId)).toBe('allow');
      
      previewGallery.handleIndividualSelection(previewId, 'block');
      expect(previewGallery.getPreviewState(previewId)).toBe('block');
      
      previewGallery.handleIndividualSelection(previewId, 'block');
      expect(previewGallery.getPreviewState(previewId)).toBe('none');
    });

    test('UIが選択状態を反映する', () => {
      const previewId = mockPreviewData[0].id;
      const previewItem = mockContainer.querySelector(`[data-preview-id="${previewId}"]`);
      
      previewGallery.handleIndividualSelection(previewId, 'allow');
      expect(previewItem.classList.contains('selected')).toBe(true);
      
      previewGallery.handleIndividualSelection(previewId, 'block');
      expect(previewItem.classList.contains('blocked')).toBe(true);
      expect(previewItem.classList.contains('selected')).toBe(false);
    });

    test('アクションボタンが正しく動作する', () => {
      const previewId = mockPreviewData[0].id;
      const allowBtn = mockContainer.querySelector(`[data-preview-id="${previewId}"][data-action="allow"]`);
      const blockBtn = mockContainer.querySelector(`[data-preview-id="${previewId}"][data-action="block"]`);
      
      // 許可ボタンをクリック
      allowBtn.click();
      expect(previewGallery.getPreviewState(previewId)).toBe('allow');
      expect(allowBtn.classList.contains('selected')).toBe(true);
      
      // ブロックボタンをクリック
      blockBtn.click();
      expect(previewGallery.getPreviewState(previewId)).toBe('block');
      expect(blockBtn.classList.contains('selected')).toBe(true);
      expect(allowBtn.classList.contains('selected')).toBe(false);
    });

    test('無効なアクションでエラーが発生しない', () => {
      const previewId = mockPreviewData[0].id;
      
      // 無効なアクションは無視される
      previewGallery.handleIndividualSelection(previewId, 'invalid');
      expect(previewGallery.getPreviewState(previewId)).toBe('none');
    });

    test('存在しないプレビューIDでエラーが発生しない', () => {
      // 存在しないIDは無視される
      previewGallery.handleIndividualSelection('nonexistent', 'allow');
      expect(previewGallery.getPreviewState('nonexistent')).toBe('none');
    });
  });

  describe('拡大表示機能', () => {
    beforeEach(async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
    });

    test('拡大表示モーダルが正しく作成される', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.showExpandedView(previewId);
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeTruthy();
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
    });

    test('拡大表示が正しく表示される', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.showExpandedView(previewId);
      
      const modal = document.querySelector('.preview-expanded-modal');
      const title = modal.querySelector('.preview-expanded-title');
      const image = modal.querySelector('.preview-expanded-image');
      
      expect(title.textContent).toBe('広告プレビュー');
      expect(image.src).toBe(mockPreviewData[0].screenshot.fullSize);
    });

    test('拡大表示が正しく閉じられる', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.showExpandedView(previewId);
      expect(document.querySelector('.preview-expanded-modal')).toBeTruthy();
      
      previewGallery.closeExpandedView();
      
      // アニメーション後に削除されるため、少し待つ
      setTimeout(() => {
        expect(document.querySelector('.preview-expanded-modal')).toBeFalsy();
      }, 350);
    });

    test('閉じるボタンが正しく動作する', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.showExpandedView(previewId);
      
      const closeBtn = document.querySelector('.preview-expanded-close');
      closeBtn.click();
      
      setTimeout(() => {
        expect(document.querySelector('.preview-expanded-modal')).toBeFalsy();
      }, 350);
    });

    test('存在しないプレビューIDで警告が出る', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      previewGallery.showExpandedView('nonexistent');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'PreviewGallery: Preview data not found for ID:',
        'nonexistent'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('一括操作機能', () => {
    beforeEach(async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
    });

    test('すべて許可が正しく動作する', () => {
      previewGallery.selectAll('allow');
      
      mockPreviewData.forEach(data => {
        expect(previewGallery.getPreviewState(data.id)).toBe('allow');
      });
    });

    test('すべてブロックが正しく動作する', () => {
      previewGallery.selectAll('block');
      
      mockPreviewData.forEach(data => {
        expect(previewGallery.getPreviewState(data.id)).toBe('block');
      });
    });

    test('すべてリセットが正しく動作する', () => {
      // 先に選択状態を設定
      previewGallery.selectAll('allow');
      
      // リセット
      previewGallery.resetAllSelections();
      
      mockPreviewData.forEach(data => {
        expect(previewGallery.getPreviewState(data.id)).toBe('none');
      });
    });

    test('無効な一括操作でエラーが発生しない', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      previewGallery.selectAll('invalid');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'PreviewGallery: Invalid bulk action:',
        'invalid'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('データ管理機能', () => {
    beforeEach(async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
    });

    test('プレビューデータが正しく取得される', () => {
      const previewId = mockPreviewData[0].id;
      const retrievedData = previewGallery.getPreviewData(previewId);
      
      expect(retrievedData).toBeTruthy();
      expect(retrievedData.id).toBe(previewId);
      expect(retrievedData.elementInfo.type).toBe('オーバーレイ広告');
    });

    test('すべてのプレビューデータが正しく取得される', () => {
      const allData = previewGallery.getAllPreviewData();
      
      expect(allData.length).toBe(mockPreviewData.length);
      expect(allData[0].id).toBe(mockPreviewData[0].id);
      expect(allData[1].id).toBe(mockPreviewData[1].id);
    });

    test('選択状態が正しく取得される', () => {
      const previewId = mockPreviewData[0].id;
      
      previewGallery.handleIndividualSelection(previewId, 'allow');
      
      const selectedStates = previewGallery.getSelectedStates();
      expect(selectedStates.get(previewId)).toBe('allow');
    });

    test('存在しないプレビューIDでnullが返される', () => {
      const retrievedData = previewGallery.getPreviewData('nonexistent');
      expect(retrievedData).toBeNull();
    });
  });

  describe('ユーティリティ機能', () => {
    test('要素タイプテキストが正しく取得される', () => {
      const testCases = [
        { elementInfo: { type: 'カスタム広告' }, expected: 'カスタム広告' },
        { elementInfo: { tagName: 'DIV' }, expected: 'オーバーレイ広告' },
        { elementInfo: { tagName: 'IFRAME' }, expected: 'フレーム広告' },
        { elementInfo: { tagName: 'IMG' }, expected: '画像広告' },
        { elementInfo: { tagName: 'VIDEO' }, expected: '動画広告' },
        { elementInfo: { tagName: 'UNKNOWN' }, expected: '広告要素' },
        { elementInfo: {}, expected: '広告要素' }
      ];
      
      testCases.forEach(testCase => {
        const result = previewGallery.getElementTypeText(testCase);
        expect(result).toBe(testCase.expected);
      });
    });

    test('要素サイズテキストが正しく取得される', () => {
      const testData = {
        elementInfo: {
          size: { width: 320, height: 240 }
        }
      };
      
      const result = previewGallery.getElementSizeText(testData);
      expect(result).toBe('320×240px');
    });

    test('要素位置テキストが正しく取得される', () => {
      const testData = {
        elementInfo: {
          position: { x: 100.5, y: 200.7 }
        }
      };
      
      const result = previewGallery.getElementPositionText(testData);
      expect(result).toBe('(101, 201)');
    });

    test('要素クラステキストが正しく取得される', () => {
      const shortClass = { elementInfo: { className: 'short-class' } };
      const longClass = { 
        elementInfo: { 
          className: 'very-long-class-name-that-exceeds-fifty-characters-limit-and-should-be-truncated' 
        } 
      };
      const noClass = { elementInfo: {} };
      
      expect(previewGallery.getElementClassText(shortClass)).toBe('short-class');
      expect(previewGallery.getElementClassText(longClass)).toContain('...');
      expect(previewGallery.getElementClassText(noClass)).toBe('なし');
    });
  });

  describe('クリーンアップ機能', () => {
    test('クリーンアップが正しく動作する', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      // 拡大表示を開く
      previewGallery.showExpandedView(mockPreviewData[0].id);
      
      expect(mockContainer.querySelector('.preview-gallery')).toBeTruthy();
      expect(document.querySelector('.preview-expanded-modal')).toBeTruthy();
      
      // クリーンアップ実行
      previewGallery.cleanup();
      
      expect(mockContainer.querySelector('.preview-gallery')).toBeFalsy();
      expect(previewGallery.previewData.size).toBe(0);
      expect(previewGallery.selectedStates.size).toBe(0);
    });
  });

  describe('デバッグ機能', () => {
    test('デバッグ情報が正しく取得される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      const debugInfo = previewGallery.getDebugInfo();
      
      expect(debugInfo.initialized).toBe(true);
      expect(debugInfo.previewCount).toBe(mockPreviewData.length);
      expect(debugInfo.selectedCount).toBe(0);
      expect(debugInfo.hasGalleryContainer).toBe(true);
      expect(debugInfo.hasExpandedModal).toBe(false);
      expect(debugInfo.options).toBeDefined();
    });

    test('選択後のデバッグ情報が正しく更新される', async () => {
      await previewGallery.renderPreviews(mockPreviewData, mockContainer);
      
      previewGallery.handleIndividualSelection(mockPreviewData[0].id, 'allow');
      
      const debugInfo = previewGallery.getDebugInfo();
      expect(debugInfo.selectedCount).toBe(1);
    });
  });

  describe('イベントハンドラー', () => {
    test('プレビュークリックイベントが正しく呼び出される', async () => {
      const onPreviewClick = jest.fn();
      const gallery = new PreviewGallery({
        onPreviewClick: onPreviewClick
      });
      
      await gallery.renderPreviews(mockPreviewData, mockContainer);
      
      const previewItem = mockContainer.querySelector('.preview-item');
      previewItem.click();
      
      expect(onPreviewClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockPreviewData[0].id }),
        expect.any(Event)
      );
    });

    test('個別選択イベントが正しく呼び出される', async () => {
      const onIndividualSelection = jest.fn();
      const gallery = new PreviewGallery({
        onIndividualSelection: onIndividualSelection
      });
      
      await gallery.renderPreviews(mockPreviewData, mockContainer);
      
      gallery.handleIndividualSelection(mockPreviewData[0].id, 'allow');
      
      expect(onIndividualSelection).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockPreviewData[0].id }),
        'allow',
        'none'
      );
    });

    test('拡大表示イベントが正しく呼び出される', async () => {
      const onExpandedView = jest.fn();
      const gallery = new PreviewGallery({
        onExpandedView: onExpandedView
      });
      
      await gallery.renderPreviews(mockPreviewData, mockContainer);
      
      gallery.showExpandedView(mockPreviewData[0].id);
      
      expect(onExpandedView).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockPreviewData[0].id })
      );
    });
  });
});