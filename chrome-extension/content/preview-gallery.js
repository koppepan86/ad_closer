/**
 * PreviewGallery - 広告プレビュー画像の表示管理クラス
 * サムネイル表示、拡大表示、個別選択機能を提供
 */

class PreviewGallery {
  constructor(options = {}) {
    this.options = {
      // 表示設定
      thumbnailWidth: options.thumbnailWidth || 300,
      thumbnailHeight: options.thumbnailHeight || 200,
      maxPreviewsPerRow: options.maxPreviewsPerRow || 3,
      
      // UI設定
      enableExpandedView: options.enableExpandedView !== false,
      enableIndividualSelection: options.enableIndividualSelection !== false,
      showElementInfo: options.showElementInfo !== false,
      
      // アニメーション設定
      animationDuration: options.animationDuration || 300,
      enableAnimations: options.enableAnimations !== false,
      
      // デバッグ設定
      debugMode: options.debugMode || false,
      
      ...options
    };

    // 内部状態
    this.previewData = new Map();
    this.selectedStates = new Map();
    this.galleryContainer = null;
    this.expandedModal = null;
    this.initialized = false;
    
    // イベントハンドラー
    this.eventHandlers = {
      onPreviewClick: options.onPreviewClick || null,
      onIndividualSelection: options.onIndividualSelection || null,
      onExpandedView: options.onExpandedView || null
    };

    // バインドされたメソッド
    this.renderPreviews = this.renderPreviews.bind(this);
    this.showExpandedView = this.showExpandedView.bind(this);
    this.handleIndividualSelection = this.handleIndividualSelection.bind(this);
    this.cleanup = this.cleanup.bind(this);

    this.init();
  }

  /**
   * 初期化
   */
  init() {
    try {
      this.injectStyles();
      this.initialized = true;
      
      if (this.options.debugMode) {
        console.log('PreviewGallery: Initialized successfully', this.options);
      }
    } catch (error) {
      console.error('PreviewGallery: Initialization failed:', error);
    }
  }

  /**
   * スタイルを注入
   */
  injectStyles() {
    if (document.getElementById('preview-gallery-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'preview-gallery-styles';
    style.textContent = `
      .preview-gallery {
        margin: 16px 0;
        padding: 0;
      }

      .preview-gallery-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }

      .preview-gallery-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .preview-count {
        font-size: 12px;
        color: #666;
        background: #f5f5f5;
        padding: 2px 8px;
        border-radius: 12px;
      }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .preview-item {
        position: relative;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background: #f9f9f9;
        transition: all 0.2s ease;
        cursor: pointer;
      }

      .preview-item:hover {
        border-color: #007bff;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
      }

      .preview-item.selected {
        border-color: #28a745;
        background: #f8fff9;
      }

      .preview-item.blocked {
        border-color: #dc3545;
        background: #fff8f8;
      }

      .preview-item.state-changing {
        transform: scale(1.02);
        transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
      }

      .preview-image-container {
        position: relative;
        width: 100%;
        height: 100px;
        overflow: hidden;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .preview-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.2s ease;
      }

      .preview-item:hover .preview-image {
        transform: scale(1.05);
      }

      .preview-fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        font-size: 12px;
        text-align: center;
        padding: 8px;
      }

      .preview-fallback-icon {
        font-size: 24px;
        margin-bottom: 4px;
        opacity: 0.5;
      }

      .preview-info {
        padding: 8px;
        background: white;
        border-top: 1px solid #e0e0e0;
      }

      .preview-type {
        font-size: 11px;
        font-weight: 600;
        color: #007bff;
        margin-bottom: 2px;
        text-transform: uppercase;
      }

      .preview-size {
        font-size: 10px;
        color: #666;
        margin-bottom: 4px;
      }

      .preview-actions {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }

      .preview-action-btn {
        flex: 1;
        padding: 4px 8px;
        font-size: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .preview-action-btn:hover {
        background: #f8f9fa;
      }

      .preview-action-btn.allow {
        color: #28a745;
        border-color: #28a745;
      }

      .preview-action-btn.allow:hover {
        background: #28a745;
        color: white;
      }

      .preview-action-btn.block {
        color: #dc3545;
        border-color: #dc3545;
      }

      .preview-action-btn.block:hover {
        background: #dc3545;
        color: white;
      }

      .preview-action-btn.selected {
        font-weight: 600;
      }

      .preview-action-btn.active {
        transform: scale(0.95);
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }

      .preview-selection-stats {
        display: flex;
        gap: 12px;
        justify-content: center;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        margin-top: 8px;
        font-size: 12px;
      }

      .stat-item {
        padding: 2px 8px;
        border-radius: 12px;
        background: white;
        border: 1px solid #dee2e6;
        color: #495057;
      }

      .preview-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100px;
        color: #666;
        font-size: 12px;
      }

      .preview-loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e0e0e0;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* 拡大表示モーダル */
      .preview-expanded-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .preview-expanded-modal.show {
        opacity: 1;
      }

      .preview-expanded-content {
        background: white;
        border-radius: 12px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.9) translateY(20px);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      .preview-expanded-modal.show .preview-expanded-content {
        transform: scale(1) translateY(0);
      }

      .preview-expanded-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        background: #f8f9fa;
      }

      .preview-expanded-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .preview-expanded-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }

      .preview-expanded-close:hover {
        background: #e9ecef;
      }

      .preview-expanded-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .preview-expanded-image {
        max-width: 100%;
        max-height: 60vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        margin-bottom: 16px;
      }

      .preview-expanded-fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        max-width: 500px;
        background: #f8f9fa;
        border: 2px dashed #dee2e6;
        border-radius: 12px;
        padding: 40px 20px;
        margin-bottom: 16px;
        text-align: center;
      }

      .preview-expanded-fallback-icon {
        font-size: 64px;
        margin-bottom: 16px;
        opacity: 0.6;
      }

      .preview-expanded-fallback-title {
        font-size: 18px;
        font-weight: 600;
        color: #495057;
        margin-bottom: 12px;
      }

      .preview-expanded-fallback-description {
        font-size: 14px;
        color: #6c757d;
        line-height: 1.5;
        margin-bottom: 16px;
        max-width: 400px;
      }

      .preview-expanded-fallback-size {
        font-size: 12px;
        color: #868e96;
        background: #e9ecef;
        padding: 4px 12px;
        border-radius: 16px;
        margin-bottom: 12px;
      }

      .preview-expanded-info {
        width: 100%;
        max-width: 400px;
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .preview-expanded-info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .preview-expanded-info-row:last-child {
        margin-bottom: 0;
      }

      .preview-expanded-info-label {
        font-weight: 600;
        color: #333;
      }

      .preview-expanded-info-value {
        color: #666;
        text-align: right;
      }

      .preview-expanded-actions {
        display: flex;
        gap: 12px;
      }

      .preview-expanded-action-btn {
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        border: 2px solid;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 100px;
      }

      .preview-expanded-action-btn.allow {
        color: #28a745;
        border-color: #28a745;
        background: white;
      }

      .preview-expanded-action-btn.allow:hover {
        background: #28a745;
        color: white;
      }

      .preview-expanded-action-btn.block {
        color: #dc3545;
        border-color: #dc3545;
        background: white;
      }

      .preview-expanded-action-btn.block:hover {
        background: #dc3545;
        color: white;
      }

      /* レスポンシブ対応 */
      @media (max-width: 480px) {
        .preview-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .preview-image-container {
          height: 80px;
        }

        .preview-info {
          padding: 6px;
        }

        .preview-expanded-content {
          margin: 20px;
          max-width: calc(100vw - 40px);
          max-height: calc(100vh - 40px);
        }

        .preview-expanded-body {
          padding: 16px;
        }

        .preview-expanded-image {
          max-height: 50vh;
        }
      }

      /* アクセシビリティ */
      .preview-item:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }

      .preview-action-btn:focus,
      .preview-expanded-action-btn:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }

      /* ダークモード対応 */
      @media (prefers-color-scheme: dark) {
        .preview-gallery-header {
          border-bottom-color: #444;
        }

        .preview-gallery-title {
          color: #e0e0e0;
        }

        .preview-count {
          background: #333;
          color: #ccc;
        }

        .preview-item {
          border-color: #444;
          background: #2a2a2a;
        }

        .preview-info {
          background: #333;
          border-top-color: #444;
        }

        .preview-expanded-content {
          background: #2a2a2a;
        }

        .preview-expanded-header {
          background: #333;
          border-bottom-color: #444;
        }

        .preview-expanded-title {
          color: #e0e0e0;
        }

        .preview-expanded-info {
          background: #333;
        }

        .preview-expanded-info-label {
          color: #e0e0e0;
        }

        .preview-expanded-info-value {
          color: #ccc;
        }

        .preview-expanded-fallback {
          background: #333;
          border-color: #555;
        }

        .preview-expanded-fallback-title {
          color: #e0e0e0;
        }

        .preview-expanded-fallback-description {
          color: #ccc;
        }

        .preview-expanded-fallback-size {
          background: #444;
          color: #ccc;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * プレビューデータを設定してギャラリーを描画
   * @param {Array} previewDataArray - プレビューデータ配列
   * @param {HTMLElement} container - 描画先コンテナ
   * @returns {Promise<HTMLElement>} ギャラリー要素
   */
  async renderPreviews(previewDataArray, container) {
    if (!this.initialized) {
      throw new Error('PreviewGallery not initialized');
    }

    if (!Array.isArray(previewDataArray)) {
      throw new Error('Preview data must be an array');
    }

    if (!container) {
      throw new Error('Container element is required');
    }

    try {
      // プレビューデータを保存
      this.previewData.clear();
      this.selectedStates.clear();
      
      previewDataArray.forEach((data, index) => {
        const id = data.id || `preview_${index}`;
        this.previewData.set(id, { ...data, id });
        this.selectedStates.set(id, 'none'); // 'none', 'allow', 'block'
      });

      // ギャラリー要素を作成
      this.galleryContainer = this.createGalleryElement(previewDataArray);
      
      // コンテナに追加
      container.appendChild(this.galleryContainer);

      if (this.options.debugMode) {
        console.log('PreviewGallery: Rendered successfully', {
          previewCount: previewDataArray.length,
          container: container
        });
      }

      return this.galleryContainer;

    } catch (error) {
      console.error('PreviewGallery: Render failed:', error);
      throw error;
    }
  }

  /**
   * ギャラリー要素を作成
   * @param {Array} previewDataArray - プレビューデータ配列
   * @returns {HTMLElement} ギャラリー要素
   */
  createGalleryElement(previewDataArray) {
    const gallery = document.createElement('div');
    gallery.className = 'preview-gallery';

    // ヘッダー作成
    const header = this.createGalleryHeader(previewDataArray.length);
    gallery.appendChild(header);

    // グリッド作成
    const grid = this.createPreviewGrid(previewDataArray);
    gallery.appendChild(grid);

    return gallery;
  }

  /**
   * ギャラリーヘッダーを作成
   * @param {number} previewCount - プレビュー数
   * @returns {HTMLElement} ヘッダー要素
   */
  createGalleryHeader(previewCount) {
    const header = document.createElement('div');
    header.className = 'preview-gallery-header';

    const titleSection = document.createElement('div');
    titleSection.style.display = 'flex';
    titleSection.style.alignItems = 'center';
    titleSection.style.gap = '8px';

    const title = document.createElement('h3');
    title.className = 'preview-gallery-title';
    title.textContent = '検出された広告';

    const count = document.createElement('span');
    count.className = 'preview-count';
    count.textContent = `${previewCount}個`;

    titleSection.appendChild(title);
    titleSection.appendChild(count);

    // 選択状態統計を追加
    const stats = document.createElement('div');
    stats.className = 'preview-selection-stats';
    stats.innerHTML = `
      <span class="stat-item">許可: 0</span>
      <span class="stat-item">ブロック: 0</span>
      <span class="stat-item">未選択: ${previewCount}</span>
    `;

    header.appendChild(titleSection);
    header.appendChild(stats);

    return header;
  }

  /**
   * プレビューグリッドを作成
   * @param {Array} previewDataArray - プレビューデータ配列
   * @returns {HTMLElement} グリッド要素
   */
  createPreviewGrid(previewDataArray) {
    const grid = document.createElement('div');
    grid.className = 'preview-grid';

    previewDataArray.forEach((data, index) => {
      const previewItem = this.createPreviewItem(data, index);
      grid.appendChild(previewItem);
    });

    return grid;
  }

  /**
   * 個別プレビューアイテムを作成
   * @param {Object} previewData - プレビューデータ
   * @param {number} index - インデックス
   * @returns {HTMLElement} プレビューアイテム要素
   */
  createPreviewItem(previewData, index) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.setAttribute('data-preview-id', previewData.id);
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `広告プレビュー ${index + 1}`);

    // 画像コンテナ作成
    const imageContainer = this.createImageContainer(previewData);
    item.appendChild(imageContainer);

    // 情報パネル作成
    if (this.options.showElementInfo) {
      const infoPanel = this.createInfoPanel(previewData);
      item.appendChild(infoPanel);
    }

    // イベントリスナー追加
    this.attachPreviewItemEvents(item, previewData);

    return item;
  }

  /**
   * 画像コンテナを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} 画像コンテナ要素
   */
  createImageContainer(previewData) {
    const container = document.createElement('div');
    container.className = 'preview-image-container';

    if (previewData.screenshot && previewData.screenshot.thumbnail) {
      // 正常な画像の場合
      const img = document.createElement('img');
      img.className = 'preview-image';
      img.src = previewData.screenshot.thumbnail;
      img.alt = `広告プレビュー: ${this.getElementTypeText(previewData)}`;
      img.loading = 'lazy';
      
      // 画像読み込みエラー時のフォールバック
      img.onerror = () => {
        container.innerHTML = '';
        container.appendChild(this.createFallbackContent(previewData));
      };

      container.appendChild(img);
    } else {
      // フォールバック表示
      container.appendChild(this.createFallbackContent(previewData));
    }

    return container;
  }

  /**
   * フォールバック表示を作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} フォールバック要素
   */
  createFallbackContent(previewData) {
    const fallback = document.createElement('div');
    fallback.className = 'preview-fallback';

    const icon = document.createElement('div');
    icon.className = 'preview-fallback-icon';
    icon.textContent = this.getElementIcon(previewData);

    const text = document.createElement('div');
    text.textContent = this.getElementTypeText(previewData);

    fallback.appendChild(icon);
    fallback.appendChild(text);

    return fallback;
  }

  /**
   * 情報パネルを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} 情報パネル要素
   */
  createInfoPanel(previewData) {
    const panel = document.createElement('div');
    panel.className = 'preview-info';

    // 要素タイプ
    const type = document.createElement('div');
    type.className = 'preview-type';
    type.textContent = this.getElementTypeText(previewData);
    panel.appendChild(type);

    // サイズ情報
    if (previewData.elementInfo && previewData.elementInfo.size) {
      const size = document.createElement('div');
      size.className = 'preview-size';
      size.textContent = `${previewData.elementInfo.size.width}×${previewData.elementInfo.size.height}px`;
      panel.appendChild(size);
    }

    // 個別選択ボタン
    if (this.options.enableIndividualSelection) {
      const actions = this.createActionButtons(previewData);
      panel.appendChild(actions);
    }

    return panel;
  }

  /**
   * アクションボタンを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} アクションボタン要素
   */
  createActionButtons(previewData) {
    const actions = document.createElement('div');
    actions.className = 'preview-actions';

    const allowBtn = document.createElement('button');
    allowBtn.className = 'preview-action-btn allow';
    allowBtn.textContent = '許可';
    allowBtn.setAttribute('data-action', 'allow');
    allowBtn.setAttribute('data-preview-id', previewData.id);

    const blockBtn = document.createElement('button');
    blockBtn.className = 'preview-action-btn block';
    blockBtn.textContent = 'ブロック';
    blockBtn.setAttribute('data-action', 'block');
    blockBtn.setAttribute('data-preview-id', previewData.id);

    // イベントリスナー追加
    allowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleIndividualSelection(previewData.id, 'allow');
    });

    blockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleIndividualSelection(previewData.id, 'block');
    });

    actions.appendChild(allowBtn);
    actions.appendChild(blockBtn);

    return actions;
  }

  /**
   * プレビューアイテムにイベントリスナーを追加
   * @param {HTMLElement} item - プレビューアイテム要素
   * @param {Object} previewData - プレビューデータ
   */
  attachPreviewItemEvents(item, previewData) {
    // クリックイベント（拡大表示）
    if (this.options.enableExpandedView) {
      item.addEventListener('click', (e) => {
        // アクションボタンのクリックは除外
        if (e.target.classList.contains('preview-action-btn')) {
          return;
        }
        this.showExpandedView(previewData.id);
      });

      // キーボードイベント
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.showExpandedView(previewData.id);
        }
      });
    }

    // プレビュークリックイベントハンドラー
    if (this.eventHandlers.onPreviewClick) {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('preview-action-btn')) {
          this.eventHandlers.onPreviewClick(previewData, e);
        }
      });
    }
  }

  /**
   * 拡大表示モーダルを表示
   * @param {string} previewId - プレビューID
   */
  showExpandedView(previewId) {
    if (!this.options.enableExpandedView) {
      return;
    }

    const previewData = this.previewData.get(previewId);
    if (!previewData) {
      console.warn('PreviewGallery: Preview data not found for ID:', previewId);
      return;
    }

    try {
      // 既存のモーダルを閉じる
      this.closeExpandedView();

      // モーダル作成
      this.expandedModal = this.createExpandedModal(previewData);
      document.body.appendChild(this.expandedModal);

      // アニメーション付きで表示
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.expandedModal.classList.add('show');
        });
      });

      // イベントハンドラー呼び出し
      if (this.eventHandlers.onExpandedView) {
        this.eventHandlers.onExpandedView(previewData);
      }

      if (this.options.debugMode) {
        console.log('PreviewGallery: Expanded view shown for:', previewId);
      }

    } catch (error) {
      console.error('PreviewGallery: Failed to show expanded view:', error);
    }
  }

  /**
   * 拡大表示モーダルを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} モーダル要素
   */
  createExpandedModal(previewData) {
    const modal = document.createElement('div');
    modal.className = 'preview-expanded-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'expanded-title');

    const content = document.createElement('div');
    content.className = 'preview-expanded-content';

    // ヘッダー
    const header = this.createExpandedHeader(previewData);
    content.appendChild(header);

    // ボディ
    const body = this.createExpandedBody(previewData);
    content.appendChild(body);

    modal.appendChild(content);

    // イベントリスナー追加
    this.attachExpandedModalEvents(modal, previewData);

    return modal;
  }

  /**
   * 拡大表示ヘッダーを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} ヘッダー要素
   */
  createExpandedHeader(previewData) {
    const header = document.createElement('div');
    header.className = 'preview-expanded-header';

    const title = document.createElement('h2');
    title.id = 'expanded-title';
    title.className = 'preview-expanded-title';
    title.textContent = '広告プレビュー';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'preview-expanded-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', '閉じる');

    closeBtn.addEventListener('click', () => {
      this.closeExpandedView();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * 拡大表示ボディを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} ボディ要素
   */
  createExpandedBody(previewData) {
    const body = document.createElement('div');
    body.className = 'preview-expanded-body';

    // 拡大画像またはフォールバック表示
    if (previewData.screenshot && previewData.screenshot.fullSize) {
      const img = document.createElement('img');
      img.className = 'preview-expanded-image';
      img.src = previewData.screenshot.fullSize;
      img.alt = `拡大表示: ${this.getElementTypeText(previewData)}`;
      
      // 画像読み込みエラー時のフォールバック
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = this.createExpandedFallback(previewData);
        body.insertBefore(fallback, body.firstChild);
      };
      
      body.appendChild(img);
    } else {
      // スクリーンショットが利用できない場合のフォールバック表示
      const fallback = this.createExpandedFallback(previewData);
      body.appendChild(fallback);
    }

    // 詳細情報
    const info = this.createExpandedInfo(previewData);
    body.appendChild(info);

    // アクションボタン
    if (this.options.enableIndividualSelection) {
      const actions = this.createExpandedActions(previewData);
      body.appendChild(actions);
    }

    return body;
  }

  /**
   * 拡大表示用フォールバック表示を作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} フォールバック要素
   */
  createExpandedFallback(previewData) {
    const fallback = document.createElement('div');
    fallback.className = 'preview-expanded-fallback';
    
    const icon = document.createElement('div');
    icon.className = 'preview-expanded-fallback-icon';
    icon.textContent = this.getElementIcon(previewData);
    
    const title = document.createElement('div');
    title.className = 'preview-expanded-fallback-title';
    title.textContent = this.getElementTypeText(previewData);
    
    const description = document.createElement('div');
    description.className = 'preview-expanded-fallback-description';
    
    if (previewData.fallback && previewData.fallback.description) {
      description.textContent = previewData.fallback.description;
    } else {
      description.textContent = 'プレビュー画像は利用できませんが、要素の詳細情報を確認できます。';
    }
    
    // サイズ情報を表示
    if (previewData.elementInfo && previewData.elementInfo.size) {
      const sizeInfo = document.createElement('div');
      sizeInfo.className = 'preview-expanded-fallback-size';
      sizeInfo.textContent = `サイズ: ${previewData.elementInfo.size.width}×${previewData.elementInfo.size.height}px`;
      fallback.appendChild(sizeInfo);
    }
    
    fallback.appendChild(icon);
    fallback.appendChild(title);
    fallback.appendChild(description);
    
    return fallback;
  }

  /**
   * 拡大表示詳細情報を作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} 詳細情報要素
   */
  createExpandedInfo(previewData) {
    const info = document.createElement('div');
    info.className = 'preview-expanded-info';

    const infoData = [
      { label: 'タイプ', value: this.getElementTypeText(previewData) },
      { label: 'サイズ', value: this.getElementSizeText(previewData) },
      { label: '位置', value: this.getElementPositionText(previewData) },
      { label: 'クラス', value: this.getElementClassText(previewData) }
    ];

    infoData.forEach(item => {
      if (item.value) {
        const row = document.createElement('div');
        row.className = 'preview-expanded-info-row';

        const label = document.createElement('span');
        label.className = 'preview-expanded-info-label';
        label.textContent = item.label + ':';

        const value = document.createElement('span');
        value.className = 'preview-expanded-info-value';
        value.textContent = item.value;

        row.appendChild(label);
        row.appendChild(value);
        info.appendChild(row);
      }
    });

    return info;
  }

  /**
   * 拡大表示アクションボタンを作成
   * @param {Object} previewData - プレビューデータ
   * @returns {HTMLElement} アクションボタン要素
   */
  createExpandedActions(previewData) {
    const actions = document.createElement('div');
    actions.className = 'preview-expanded-actions';

    const allowBtn = document.createElement('button');
    allowBtn.className = 'preview-expanded-action-btn allow';
    allowBtn.textContent = '許可';

    const blockBtn = document.createElement('button');
    blockBtn.className = 'preview-expanded-action-btn block';
    blockBtn.textContent = 'ブロック';

    // 現在の選択状態を反映
    const currentState = this.selectedStates.get(previewData.id);
    if (currentState === 'allow') {
      allowBtn.classList.add('selected');
    } else if (currentState === 'block') {
      blockBtn.classList.add('selected');
    }

    // イベントリスナー追加
    allowBtn.addEventListener('click', () => {
      this.handleIndividualSelection(previewData.id, 'allow');
      this.closeExpandedView();
    });

    blockBtn.addEventListener('click', () => {
      this.handleIndividualSelection(previewData.id, 'block');
      this.closeExpandedView();
    });

    actions.appendChild(allowBtn);
    actions.appendChild(blockBtn);

    return actions;
  }

  /**
   * 拡大表示モーダルにイベントリスナーを追加
   * @param {HTMLElement} modal - モーダル要素
   * @param {Object} previewData - プレビューデータ
   */
  attachExpandedModalEvents(modal, previewData) {
    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeExpandedView();
      }
    });

    // ESCキーで閉じる
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.closeExpandedView();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // フォーカストラップ
    this.setupFocusTrap(modal);
  }

  /**
   * フォーカストラップを設定
   * @param {HTMLElement} modal - モーダル要素
   */
  setupFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 最初の要素にフォーカス
    firstElement.focus();

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  /**
   * 拡大表示モーダルを閉じる
   */
  closeExpandedView() {
    if (!this.expandedModal) {
      return;
    }

    // アニメーション付きで非表示
    this.expandedModal.classList.remove('show');

    setTimeout(() => {
      if (this.expandedModal && this.expandedModal.parentNode) {
        this.expandedModal.parentNode.removeChild(this.expandedModal);
      }
      this.expandedModal = null;
    }, this.options.animationDuration);
  }

  /**
   * 個別選択を処理
   * @param {string} previewId - プレビューID
   * @param {string} action - アクション ('allow' | 'block')
   */
  handleIndividualSelection(previewId, action) {
    if (!['allow', 'block'].includes(action)) {
      console.warn('PreviewGallery: Invalid action:', action);
      return;
    }

    const previewData = this.previewData.get(previewId);
    if (!previewData) {
      console.warn('PreviewGallery: Preview data not found for ID:', previewId);
      return;
    }

    try {
      // 選択状態を更新（トグル機能付き）
      const previousState = this.selectedStates.get(previewId);
      const newState = previousState === action ? 'none' : action;
      this.selectedStates.set(previewId, newState);

      // UI更新（即座に反映）
      this.updatePreviewItemState(previewId, newState);
      
      // 拡大表示モーダルのボタンも更新
      this.updateExpandedModalButtons(previewId, newState);

      // 選択状態の統計を更新
      this.updateSelectionStats();

      // イベントハンドラー呼び出し
      if (this.eventHandlers.onIndividualSelection) {
        this.eventHandlers.onIndividualSelection(previewData, newState, previousState);
      }

      // 視覚的フィードバック（アニメーション）
      this.showSelectionFeedback(previewId, newState);

      if (this.options.debugMode) {
        console.log('PreviewGallery: Individual selection updated:', {
          previewId,
          action: newState,
          previousState,
          allStates: Object.fromEntries(this.selectedStates)
        });
      }

    } catch (error) {
      console.error('PreviewGallery: Failed to handle individual selection:', error);
    }
  }

  /**
   * プレビューアイテムの状態を更新
   * @param {string} previewId - プレビューID
   * @param {string} state - 新しい状態
   */
  updatePreviewItemState(previewId, state) {
    if (!this.galleryContainer) {
      return;
    }

    const item = this.galleryContainer.querySelector(`[data-preview-id="${previewId}"]`);
    if (!item) {
      return;
    }

    // CSSクラスを更新（アニメーション付き）
    item.classList.remove('selected', 'blocked', 'state-changing');
    
    // 状態変更アニメーションを追加
    item.classList.add('state-changing');
    
    requestAnimationFrame(() => {
      if (state === 'allow') {
        item.classList.add('selected');
        item.setAttribute('aria-label', `広告プレビュー - 許可済み`);
      } else if (state === 'block') {
        item.classList.add('blocked');
        item.setAttribute('aria-label', `広告プレビュー - ブロック済み`);
      } else {
        item.setAttribute('aria-label', `広告プレビュー - 未選択`);
      }
      
      // アニメーションクラスを削除
      setTimeout(() => {
        item.classList.remove('state-changing');
      }, 200);
    });

    // ボタンの状態を更新
    const buttons = item.querySelectorAll('.preview-action-btn');
    buttons.forEach(btn => {
      btn.classList.remove('selected', 'active');
      btn.disabled = false;
      
      if (btn.getAttribute('data-action') === state) {
        btn.classList.add('selected', 'active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // 選択状態インジケーターを更新
    this.updateSelectionIndicator(item, state);
  }

  /**
   * 選択状態を取得
   * @returns {Map} 選択状態マップ
   */
  getSelectedStates() {
    return new Map(this.selectedStates);
  }

  /**
   * 特定のプレビューの選択状態を取得
   * @param {string} previewId - プレビューID
   * @returns {string} 選択状態
   */
  getPreviewState(previewId) {
    return this.selectedStates.get(previewId) || 'none';
  }

  /**
   * すべてのプレビューの選択状態をリセット
   */
  resetAllSelections() {
    this.selectedStates.forEach((state, previewId) => {
      this.selectedStates.set(previewId, 'none');
      this.updatePreviewItemState(previewId, 'none');
    });

    if (this.options.debugMode) {
      console.log('PreviewGallery: All selections reset');
    }
  }

  /**
   * すべてのプレビューを一括選択
   * @param {string} action - アクション ('allow' | 'block')
   */
  selectAll(action) {
    if (!['allow', 'block'].includes(action)) {
      console.warn('PreviewGallery: Invalid bulk action:', action);
      return;
    }

    try {
      // 各プレビューの状態を更新
      this.selectedStates.forEach((currentState, previewId) => {
        const previousState = currentState;
        this.selectedStates.set(previewId, action);
        this.updatePreviewItemState(previewId, action);
        
        // 拡大表示モーダルのボタンも更新
        this.updateExpandedModalButtons(previewId, action);
        
        // 視覚的フィードバック
        this.showSelectionFeedback(previewId, action);
      });

      // 統計を更新
      this.updateSelectionStats();

      if (this.options.debugMode) {
        console.log('PreviewGallery: Bulk selection applied:', action, {
          totalItems: this.selectedStates.size,
          newState: action
        });
      }

    } catch (error) {
      console.error('PreviewGallery: Bulk selection failed:', error);
      throw error;
    }
  }

  /**
   * プレビューデータを管理
   * @param {string} previewId - プレビューID
   * @returns {Object|null} プレビューデータ
   */
  getPreviewData(previewId) {
    return this.previewData.get(previewId) || null;
  }

  /**
   * すべてのプレビューデータを取得
   * @returns {Array} プレビューデータ配列
   */
  getAllPreviewData() {
    return Array.from(this.previewData.values());
  }

  /**
   * 要素タイプテキストを取得
   * @param {Object} previewData - プレビューデータ
   * @returns {string} 要素タイプテキスト
   */
  getElementTypeText(previewData) {
    if (previewData.elementInfo && previewData.elementInfo.type) {
      return previewData.elementInfo.type;
    }
    
    if (previewData.elementInfo && previewData.elementInfo.tagName) {
      const tagName = previewData.elementInfo.tagName.toLowerCase();
      const typeMap = {
        'div': 'オーバーレイ広告',
        'iframe': 'フレーム広告',
        'img': '画像広告',
        'video': '動画広告',
        'canvas': 'Canvas広告',
        'embed': '埋め込み広告'
      };
      return typeMap[tagName] || '広告要素';
    }
    
    return '広告要素';
  }

  /**
   * 要素アイコンを取得
   * @param {Object} previewData - プレビューデータ
   * @returns {string} アイコン文字
   */
  getElementIcon(previewData) {
    const typeText = this.getElementTypeText(previewData);
    const iconMap = {
      'オーバーレイ広告': '📱',
      'フレーム広告': '🖼️',
      '画像広告': '🖼️',
      '動画広告': '🎥',
      'Canvas広告': '🎨',
      '埋め込み広告': '📦'
    };
    return iconMap[typeText] || '📄';
  }

  /**
   * 要素サイズテキストを取得
   * @param {Object} previewData - プレビューデータ
   * @returns {string} サイズテキスト
   */
  getElementSizeText(previewData) {
    if (previewData.elementInfo && previewData.elementInfo.size) {
      const { width, height } = previewData.elementInfo.size;
      return `${width}×${height}px`;
    }
    return '不明';
  }

  /**
   * 要素位置テキストを取得
   * @param {Object} previewData - プレビューデータ
   * @returns {string} 位置テキスト
   */
  getElementPositionText(previewData) {
    if (previewData.elementInfo && previewData.elementInfo.position) {
      const { x, y } = previewData.elementInfo.position;
      return `(${Math.round(x)}, ${Math.round(y)})`;
    }
    return '不明';
  }

  /**
   * 要素クラステキストを取得
   * @param {Object} previewData - プレビューデータ
   * @returns {string} クラステキスト
   */
  getElementClassText(previewData) {
    if (previewData.elementInfo && previewData.elementInfo.className) {
      const className = previewData.elementInfo.className.trim();
      return className.length > 50 ? className.substring(0, 50) + '...' : className;
    }
    return 'なし';
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    try {
      // 拡大表示モーダルを閉じる
      this.closeExpandedView();

      // ギャラリーコンテナを削除
      if (this.galleryContainer && this.galleryContainer.parentNode) {
        this.galleryContainer.parentNode.removeChild(this.galleryContainer);
      }

      // 内部状態をクリア
      this.previewData.clear();
      this.selectedStates.clear();
      this.galleryContainer = null;
      this.expandedModal = null;

      if (this.options.debugMode) {
        console.log('PreviewGallery: Cleanup completed');
      }

    } catch (error) {
      console.error('PreviewGallery: Cleanup failed:', error);
    }
  }

  /**
   * 拡大表示モーダルのボタンを更新
   * @param {string} previewId - プレビューID
   * @param {string} state - 新しい状態
   */
  updateExpandedModalButtons(previewId, state) {
    if (!this.expandedModal) {
      return;
    }

    const allowBtn = this.expandedModal.querySelector('.preview-expanded-action-btn.allow');
    const blockBtn = this.expandedModal.querySelector('.preview-expanded-action-btn.block');

    if (allowBtn && blockBtn) {
      allowBtn.classList.remove('selected', 'active');
      blockBtn.classList.remove('selected', 'active');

      if (state === 'allow') {
        allowBtn.classList.add('selected', 'active');
        allowBtn.setAttribute('aria-pressed', 'true');
        blockBtn.setAttribute('aria-pressed', 'false');
      } else if (state === 'block') {
        blockBtn.classList.add('selected', 'active');
        blockBtn.setAttribute('aria-pressed', 'true');
        allowBtn.setAttribute('aria-pressed', 'false');
      } else {
        allowBtn.setAttribute('aria-pressed', 'false');
        blockBtn.setAttribute('aria-pressed', 'false');
      }
    }
  }

  /**
   * 選択状態の統計を更新
   */
  updateSelectionStats() {
    if (!this.galleryContainer) {
      return;
    }

    const stats = {
      total: this.selectedStates.size,
      allowed: 0,
      blocked: 0,
      none: 0
    };

    this.selectedStates.forEach(state => {
      if (state === 'allow') stats.allowed++;
      else if (state === 'block') stats.blocked++;
      else stats.none++;
    });

    // 統計情報を表示する要素があれば更新
    const statsElement = this.galleryContainer.querySelector('.preview-selection-stats');
    if (statsElement) {
      statsElement.innerHTML = `
        <span class="stat-item">許可: ${stats.allowed}</span>
        <span class="stat-item">ブロック: ${stats.blocked}</span>
        <span class="stat-item">未選択: ${stats.none}</span>
      `;
    }

    // カスタムイベントを発火
    if (this.galleryContainer) {
      const event = new CustomEvent('selectionStatsUpdated', {
        detail: stats
      });
      this.galleryContainer.dispatchEvent(event);
    }
  }

  /**
   * 視覚的フィードバックを表示
   * @param {string} previewId - プレビューID
   * @param {string} state - 新しい状態
   */
  showSelectionFeedback(previewId, state) {
    if (!this.galleryContainer) {
      return;
    }

    const item = this.galleryContainer.querySelector(`[data-preview-id="${previewId}"]`);
    if (!item) {
      return;
    }

    // フィードバック要素を作成
    const feedback = document.createElement('div');
    feedback.className = 'selection-feedback';
    feedback.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${state === 'allow' ? '#28a745' : state === 'block' ? '#dc3545' : '#6c757d'};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    
    feedback.textContent = state === 'allow' ? '許可' : state === 'block' ? 'ブロック' : '未選択';

    // アイテムに相対位置を設定
    const originalPosition = item.style.position;
    item.style.position = 'relative';
    item.appendChild(feedback);

    // アニメーション
    requestAnimationFrame(() => {
      feedback.style.opacity = '1';
      
      setTimeout(() => {
        feedback.style.opacity = '0';
        
        setTimeout(() => {
          if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
          }
          item.style.position = originalPosition;
        }, 200);
      }, 800);
    });
  }

  /**
   * 選択状態インジケーターを更新
   * @param {HTMLElement} item - プレビューアイテム要素
   * @param {string} state - 選択状態
   */
  updateSelectionIndicator(item, state) {
    // 既存のインジケーターを削除
    const existingIndicator = item.querySelector('.selection-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // 新しいインジケーターを作成（選択状態がある場合のみ）
    if (state !== 'none') {
      const indicator = document.createElement('div');
      indicator.className = 'selection-indicator';
      indicator.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${state === 'allow' ? '#28a745' : '#dc3545'};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        z-index: 5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      
      indicator.textContent = state === 'allow' ? '✓' : '✕';
      indicator.setAttribute('aria-label', state === 'allow' ? '許可済み' : 'ブロック済み');
      
      // アイテムに相対位置を設定
      const originalPosition = item.style.position;
      if (!originalPosition || originalPosition === 'static') {
        item.style.position = 'relative';
      }
      
      item.appendChild(indicator);
    }
  }

  /**
   * デバッグ情報を取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo() {
    const stats = {
      total: this.selectedStates.size,
      allowed: 0,
      blocked: 0,
      none: 0
    };

    this.selectedStates.forEach(state => {
      if (state === 'allow') stats.allowed++;
      else if (state === 'block') stats.blocked++;
      else stats.none++;
    });

    return {
      initialized: this.initialized,
      previewCount: this.previewData.size,
      selectionStats: stats,
      hasGalleryContainer: !!this.galleryContainer,
      hasExpandedModal: !!this.expandedModal,
      options: this.options,
      selectedStates: Object.fromEntries(this.selectedStates)
    };
  }
}

// グローバルに公開（必要に応じて）
if (typeof window !== 'undefined') {
  window.PreviewGallery = PreviewGallery;
}