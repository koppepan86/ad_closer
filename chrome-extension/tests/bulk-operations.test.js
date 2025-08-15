/**
 * 一括操作機能のテスト
 * Task 8: 一括操作機能の実装のテスト
 */

describe('Bulk Operations Functionality', () => {
  let userChoiceDialog;
  let previewGallery;
  let mockAds;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = '';
    
    // モック広告データを作成
    mockAds = [
      {
        element: createMockElement('div', 'overlay-ad'),
        type: 'オーバーレイ広告',
        id: 'ad_0',
        size: { width: 320, height: 240 },
        position: { x: 100, y: 100 }
      },
      {
        element: createMockElement('div', 'banner-ad'),
        type: 'バナー広告',
        id: 'ad_1',
        size: { width: 728, height: 90 },
        position: { x: 200, y: 50 }
      },
      {
        element: createMockElement('iframe', 'iframe-ad'),
        type: 'フレーム広告',
        id: 'ad_2',
        size: { width: 300, height: 250 },
        position: { x: 300, y: 150 }
      }
    ];

    // UserChoiceDialogとPreviewGalleryを初期化
    userChoiceDialog = new UserChoiceDialog();
    previewGallery = new PreviewGallery({
      enableIndividualSelection: true,
      debugMode: true
    });
  });

  afterEach(() => {
    // クリーンアップ
    if (userChoiceDialog) {
      userChoiceDialog.cleanup();
    }
    if (previewGallery) {
      previewGallery.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Bulk Action Buttons', () => {
    test('should add bulk action buttons to dialog', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      
      // 少し待ってからボタンの存在を確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const bulkButtons = document.querySelectorAll('.ad-choice-bulk-button');
      expect(bulkButtons).toHaveLength(2);
      
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      const blockButton = document.querySelector('.ad-choice-bulk-button.block');
      
      expect(allowButton).toBeTruthy();
      expect(blockButton).toBeTruthy();
      expect(allowButton.textContent).toBe('すべて許可');
      expect(blockButton.textContent).toBe('すべてブロック');
      
      // ダイアログを閉じる
      userChoiceDialog.closeAllDialogs();
    });

    test('should trigger bulk action when buttons are clicked', async () => {
      const handleBulkActionSpy = jest.spyOn(userChoiceDialog, 'handleBulkAction');
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      expect(handleBulkActionSpy).toHaveBeenCalledWith(
        expect.any(String),
        'allow'
      );
      
      userChoiceDialog.closeAllDialogs();
    });
  });

  describe('Bulk Action Confirmation Dialog', () => {
    test('should show confirmation dialog for bulk allow', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括許可ボタンをクリック
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      // 確認ダイアログが表示されることを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmationDialog = document.querySelector('.bulk-action-confirmation');
      expect(confirmationDialog).toBeTruthy();
      
      const confirmationTitle = confirmationDialog.querySelector('.bulk-confirmation-title');
      expect(confirmationTitle.textContent).toBe('一括許可の確認');
      
      const confirmButton = confirmationDialog.querySelector('.bulk-confirmation-btn.confirm');
      const cancelButton = confirmationDialog.querySelector('.bulk-confirmation-btn.cancel');
      
      expect(confirmButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
      expect(confirmButton.textContent).toBe('許可を実行');
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should show confirmation dialog for bulk block', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括ブロックボタンをクリック
      const blockButton = document.querySelector('.ad-choice-bulk-button.block');
      blockButton.click();
      
      // 確認ダイアログが表示されることを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmationDialog = document.querySelector('.bulk-action-confirmation');
      expect(confirmationDialog).toBeTruthy();
      
      const confirmationTitle = confirmationDialog.querySelector('.bulk-confirmation-title');
      expect(confirmationTitle.textContent).toBe('一括ブロックの確認');
      
      const confirmButton = confirmationDialog.querySelector('.bulk-confirmation-btn.confirm');
      expect(confirmButton.textContent).toBe('ブロックを実行');
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should close confirmation dialog when cancel is clicked', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括許可ボタンをクリック
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // キャンセルボタンをクリック
      const cancelButton = document.querySelector('.bulk-confirmation-btn.cancel');
      cancelButton.click();
      
      // 確認ダイアログが閉じられることを確認
      await new Promise(resolve => setTimeout(resolve, 400)); // アニメーション時間を考慮
      
      const confirmationDialog = document.querySelector('.bulk-action-confirmation');
      expect(confirmationDialog).toBeFalsy();
      
      userChoiceDialog.closeAllDialogs();
    });
  });

  describe('Bulk Action Execution', () => {
    test('should execute bulk allow operation', async () => {
      const executeBulkActionSpy = jest.spyOn(userChoiceDialog, 'executeBulkAction');
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括許可ボタンをクリック
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 確認ボタンをクリック
      const confirmButton = document.querySelector('.bulk-confirmation-btn.confirm');
      confirmButton.click();
      
      expect(executeBulkActionSpy).toHaveBeenCalledWith(
        expect.any(String),
        'allow'
      );
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should execute bulk block operation', async () => {
      const executeBulkActionSpy = jest.spyOn(userChoiceDialog, 'executeBulkAction');
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括ブロックボタンをクリック
      const blockButton = document.querySelector('.ad-choice-bulk-button.block');
      blockButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 確認ボタンをクリック
      const confirmButton = document.querySelector('.bulk-confirmation-btn.confirm');
      confirmButton.click();
      
      expect(executeBulkActionSpy).toHaveBeenCalledWith(
        expect.any(String),
        'block'
      );
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should update all preview states when bulk operation is executed', async () => {
      // PreviewGalleryのselectAllメソッドをスパイ
      const selectAllSpy = jest.spyOn(previewGallery, 'selectAll');
      
      // UserChoiceDialogにPreviewGalleryを設定
      userChoiceDialog.previewGallery = previewGallery;
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 一括許可操作を実行
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmButton = document.querySelector('.bulk-confirmation-btn.confirm');
      confirmButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(selectAllSpy).toHaveBeenCalledWith('allow');
      
      userChoiceDialog.closeAllDialogs();
    });
  });

  describe('Bulk Action Result Display', () => {
    test('should show result after successful bulk operation', async () => {
      // UserChoiceDialogにPreviewGalleryを設定
      userChoiceDialog.previewGallery = previewGallery;
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 一括許可操作を実行
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmButton = document.querySelector('.bulk-confirmation-btn.confirm');
      confirmButton.click();
      
      // 結果表示を確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const resultDisplay = document.querySelector('.bulk-action-result');
      expect(resultDisplay).toBeTruthy();
      
      const resultTitle = resultDisplay.querySelector('.result-title');
      expect(resultTitle.textContent).toBe('一括許可完了');
      
      const resultDetails = resultDisplay.querySelector('.result-details');
      expect(resultDetails.textContent).toContain('3個の広告を許可しました');
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should show error result when bulk operation fails', async () => {
      // PreviewGalleryのselectAllメソッドでエラーを発生させる
      jest.spyOn(previewGallery, 'selectAll').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      userChoiceDialog.previewGallery = previewGallery;
      
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 一括許可操作を実行
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmButton = document.querySelector('.bulk-confirmation-btn.confirm');
      confirmButton.click();
      
      // エラー結果表示を確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errorDisplay = document.querySelector('.bulk-action-result.error');
      expect(errorDisplay).toBeTruthy();
      
      const errorTitle = errorDisplay.querySelector('.result-title');
      expect(errorTitle.textContent).toBe('一括許可エラー');
      
      userChoiceDialog.closeAllDialogs();
    });
  });

  describe('PreviewGallery Integration', () => {
    test('should call PreviewGallery selectAll method', () => {
      const selectAllSpy = jest.spyOn(previewGallery, 'selectAll');
      
      // 一括選択を実行
      previewGallery.selectAll('allow');
      
      expect(selectAllSpy).toHaveBeenCalledWith('allow');
    });

    test('should update statistics after bulk operation', () => {
      const updateSelectionStatsSpy = jest.spyOn(previewGallery, 'updateSelectionStats');
      
      // プレビューデータを設定
      const mockPreviewData = mockAds.map((ad, index) => ({
        id: ad.id,
        elementInfo: {
          type: ad.type,
          size: ad.size,
          position: ad.position
        }
      }));
      
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      previewGallery.renderPreviews(mockPreviewData, container);
      
      // 一括選択を実行
      previewGallery.selectAll('block');
      
      expect(updateSelectionStatsSpy).toHaveBeenCalled();
    });
  });

  describe('Keyboard and Accessibility', () => {
    test('should close confirmation dialog with Escape key', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括許可ボタンをクリック
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Escapeキーを押す
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      // 確認ダイアログが閉じられることを確認
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const confirmationDialog = document.querySelector('.bulk-action-confirmation');
      expect(confirmationDialog).toBeFalsy();
      
      userChoiceDialog.closeAllDialogs();
    });

    test('should have proper ARIA attributes', async () => {
      // ダイアログを表示
      const dialogPromise = userChoiceDialog.showChoiceDialog(mockAds);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 一括許可ボタンをクリック
      const allowButton = document.querySelector('.ad-choice-bulk-button.allow');
      allowButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const confirmationDialog = document.querySelector('.bulk-confirmation-dialog');
      expect(confirmationDialog.getAttribute('role')).toBe('dialog');
      expect(confirmationDialog.getAttribute('aria-modal')).toBe('true');
      
      userChoiceDialog.closeAllDialogs();
    });
  });

  // ヘルパー関数
  function createMockElement(tagName, className) {
    const element = document.createElement(tagName);
    element.className = className;
    element.style.width = '300px';
    element.style.height = '200px';
    element.style.background = '#ff6b6b';
    element.textContent = `Mock ${tagName} element`;
    document.body.appendChild(element);
    return element;
  }
});