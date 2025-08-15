/**
 * インアプリヘルプシステム
 * ユーザーが拡張機能内で直接ヘルプを参照できるシステム
 */

/**
 * ヘルプシステムクラス
 */
class HelpSystem {
  constructor(logger) {
    this.logger = logger;
    this.helpData = new Map();
    this.currentContext = null;
    this.helpModal = null;
    this.searchIndex = new Map();
    
    this.initializeHelpData();
    this.createHelpInterface();
    this.setupEventListeners();
  }

  /**
   * ヘルプデータの初期化
   */
  initializeHelpData() {
    // 基本的な使い方
    this.helpData.set('basic_usage', {
      title: '基本的な使い方',
      category: 'getting_started',
      content: `
        <h3>ポップアップ広告ブロッカーの基本的な使い方</h3>
        <ol>
          <li><strong>自動検出</strong>: ウェブページでポップアップが表示されると自動的に検出されます</li>
          <li><strong>通知表示</strong>: 検出されたポップアップについて通知が表示されます</li>
          <li><strong>選択</strong>: 「閉じる」または「保持」を選択してください</li>
          <li><strong>学習</strong>: あなたの選択が記憶され、次回から自動適用されます</li>
        </ol>
        <div class="help-tip">
          💡 <strong>ヒント</strong>: 初回使用時は通知をよく読んで、適切な選択をしてください。
        </div>
      `,
      keywords: ['基本', '使い方', '開始', 'スタート', '初心者']
    });

    // ポップアップ検出について
    this.helpData.set('popup_detection', {
      title: 'ポップアップ検出について',
      category: 'features',
      content: `
        <h3>ポップアップ検出の仕組み</h3>
        <p>拡張機能は以下の特徴を持つ要素をポップアップとして検出します：</p>
        <ul>
          <li>モーダルオーバーレイ（画面全体を覆う要素）</li>
          <li>高いz-index値を持つ要素</li>
          <li>固定位置（position: fixed）の要素</li>
          <li>閉じるボタンを持つダイアログ</li>
          <li>広告関連のコンテンツを含む要素</li>
        </ul>
        
        <h4>正当なポップアップの保護</h4>
        <p>以下は自動的に保護され、ブロック対象から除外されます：</p>
        <ul>
          <li>ログインフォーム</li>
          <li>重要なサイト通知</li>
          <li>ショッピングカート</li>
          <li>ファイルダウンロードダイアログ</li>
        </ul>
      `,
      keywords: ['検出', 'ポップアップ', '仕組み', 'アルゴリズム', '保護']
    });

    // 学習機能について
    this.helpData.set('learning_system', {
      title: '学習機能について',
      category: 'features',
      content: `
        <h3>学習機能の仕組み</h3>
        <p>拡張機能はあなたの決定を学習し、次回から自動的に適用します：</p>
        
        <h4>学習プロセス</h4>
        <ol>
          <li><strong>パターン認識</strong>: ポップアップの特徴を分析</li>
          <li><strong>決定記録</strong>: あなたの選択を記憶</li>
          <li><strong>パターンマッチング</strong>: 類似のポップアップを識別</li>
          <li><strong>自動適用</strong>: 学習した決定を自動実行</li>
        </ol>
        
        <h4>学習データの管理</h4>
        <p>設定ページから以下の操作が可能です：</p>
        <ul>
          <li>学習データの確認</li>
          <li>個別パターンの削除</li>
          <li>全データのリセット</li>
          <li>学習機能のオン/オフ</li>
        </ul>
        
        <div class="help-warning">
          ⚠️ <strong>注意</strong>: 学習データをリセットすると、すべての決定履歴が削除されます。
        </div>
      `,
      keywords: ['学習', '自動', 'パターン', '記憶', 'AI']
    });

    // 設定について
    this.helpData.set('settings', {
      title: '設定について',
      category: 'configuration',
      content: `
        <h3>設定項目の説明</h3>
        
        <h4>基本設定</h4>
        <ul>
          <li><strong>拡張機能の有効/無効</strong>: 全体的なオン/オフ切り替え</li>
          <li><strong>通知の表示</strong>: ポップアップ検出時の通知表示</li>
          <li><strong>通知表示時間</strong>: 通知が表示される時間（秒）</li>
          <li><strong>学習機能</strong>: 自動学習のオン/オフ</li>
        </ul>
        
        <h4>検出設定</h4>
        <ul>
          <li><strong>検出感度</strong>: 低（厳選）/ 中（推奨）/ 高（積極的）</li>
          <li><strong>検出遅延</strong>: ページ読み込み後の検出開始時間</li>
          <li><strong>正当性判定</strong>: 正当なポップアップの判定基準</li>
        </ul>
        
        <h4>ホワイトリスト</h4>
        <p>信頼できるウェブサイトを登録して、検出を無効化できます。</p>
        
        <div class="help-tip">
          💡 <strong>推奨設定</strong>: 初心者の方は検出感度を「中」に設定することをお勧めします。
        </div>
      `,
      keywords: ['設定', '構成', 'オプション', 'カスタマイズ', '調整']
    });

    // トラブルシューティング
    this.helpData.set('troubleshooting', {
      title: 'トラブルシューティング',
      category: 'support',
      content: `
        <h3>よくある問題と解決方法</h3>
        
        <h4>ポップアップが検出されない</h4>
        <ol>
          <li>拡張機能が有効になっているか確認</li>
          <li>サイトがホワイトリストに入っていないか確認</li>
          <li>検出感度を上げる</li>
          <li>ページを再読み込み</li>
        </ol>
        
        <h4>正当なポップアップが閉じられる</h4>
        <ol>
          <li>該当サイトをホワイトリストに追加</li>
          <li>学習データをリセット</li>
          <li>検出感度を下げる</li>
        </ol>
        
        <h4>拡張機能が動作しない</h4>
        <ol>
          <li>Chromeを再起動</li>
          <li>拡張機能を無効にして再有効化</li>
          <li>権限設定を確認</li>
          <li>最新版に更新</li>
        </ol>
        
        <h4>パフォーマンスが悪い</h4>
        <ol>
          <li>不要なサイトをホワイトリストに追加</li>
          <li>検出遅延を増加</li>
          <li>詳細ログを無効化</li>
          <li>統計データをクリア</li>
        </ol>
        
        <div class="help-contact">
          📧 <strong>サポート</strong>: 問題が解決しない場合は、GitHubのIssuesページでお問い合わせください。
        </div>
      `,
      keywords: ['問題', 'エラー', '解決', 'トラブル', 'サポート']
    });

    // ショートカット
    this.helpData.set('shortcuts', {
      title: 'ショートカットとヒント',
      category: 'tips',
      content: `
        <h3>便利なショートカットとヒント</h3>
        
        <h4>キーボードショートカット</h4>
        <ul>
          <li><kbd>Alt</kbd> + <kbd>P</kbd>: 拡張機能ポップアップを開く</li>
          <li><kbd>Alt</kbd> + <kbd>S</kbd>: 設定ページを開く</li>
          <li><kbd>Esc</kbd>: 通知を閉じる</li>
        </ul>
        
        <h4>効率的な使い方のヒント</h4>
        <ul>
          <li><strong>初期設定</strong>: よく使うサイトを事前にホワイトリストに登録</li>
          <li><strong>学習活用</strong>: 最初の数回は慎重に選択して学習精度を向上</li>
          <li><strong>統計確認</strong>: 定期的に統計を確認してブロック効果を把握</li>
          <li><strong>設定調整</strong>: サイトの種類に応じて検出感度を調整</li>
        </ul>
        
        <h4>パフォーマンス最適化</h4>
        <ul>
          <li>信頼できるサイトはホワイトリストに追加</li>
          <li>不要な統計データは定期的にクリア</li>
          <li>検出遅延を適切に設定</li>
        </ul>
        
        <div class="help-tip">
          💡 <strong>プロのヒント</strong>: 拡張機能アイコンを右クリックすると、クイック設定メニューが表示されます。
        </div>
      `,
      keywords: ['ショートカット', 'ヒント', 'コツ', '効率', '最適化']
    });

    // プライバシーとセキュリティ
    this.helpData.set('privacy_security', {
      title: 'プライバシーとセキュリティ',
      category: 'security',
      content: `
        <h3>プライバシーとセキュリティについて</h3>
        
        <h4>データの取り扱い</h4>
        <ul>
          <li><strong>ローカル保存</strong>: すべてのデータはお使いのコンピューターにのみ保存</li>
          <li><strong>外部送信なし</strong>: 個人情報や閲覧履歴は外部に送信されません</li>
          <li><strong>暗号化</strong>: 機密設定は暗号化して保存</li>
          <li><strong>自動削除</strong>: 古いデータは自動的に削除</li>
        </ul>
        
        <h4>必要な権限</h4>
        <ul>
          <li><strong>activeTab</strong>: 現在のタブでのポップアップ検出に必要</li>
          <li><strong>storage</strong>: 設定と学習データの保存に必要</li>
          <li><strong>notifications</strong>: ポップアップ検出時の通知表示に必要</li>
        </ul>
        
        <h4>セキュリティ機能</h4>
        <ul>
          <li><strong>CSP</strong>: Content Security Policyによる保護</li>
          <li><strong>最小権限</strong>: 必要最小限の権限のみ要求</li>
          <li><strong>定期更新</strong>: セキュリティパッチの定期的な適用</li>
        </ul>
        
        <div class="help-security">
          🔒 <strong>セキュリティ</strong>: この拡張機能はオープンソースで、コードは公開されています。
        </div>
      `,
      keywords: ['プライバシー', 'セキュリティ', '権限', 'データ', '保護']
    });

    // 検索インデックスの構築
    this.buildSearchIndex();
  }

  /**
   * 検索インデックスの構築
   */
  buildSearchIndex() {
    for (const [id, data] of this.helpData.entries()) {
      // タイトルをインデックスに追加
      const titleWords = data.title.toLowerCase().split(/\s+/);
      for (const word of titleWords) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, new Set());
        }
        this.searchIndex.get(word).add(id);
      }

      // キーワードをインデックスに追加
      for (const keyword of data.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (!this.searchIndex.has(keywordLower)) {
          this.searchIndex.set(keywordLower, new Set());
        }
        this.searchIndex.get(keywordLower).add(id);
      }

      // コンテンツの重要な単語をインデックスに追加
      const contentText = data.content.replace(/<[^>]*>/g, '').toLowerCase();
      const contentWords = contentText.split(/\s+/).filter(word => word.length > 2);
      for (const word of contentWords) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, new Set());
        }
        this.searchIndex.get(word).add(id);
      }
    }
  }

  /**
   * ヘルプインターフェースの作成
   */
  createHelpInterface() {
    // ヘルプモーダルのHTML
    const modalHTML = `
      <div id="popup-blocker-help-modal" class="help-modal" style="display: none;">
        <div class="help-modal-overlay"></div>
        <div class="help-modal-content">
          <div class="help-header">
            <h2>ヘルプ - ポップアップ広告ブロッカー</h2>
            <button class="help-close-btn">&times;</button>
          </div>
          
          <div class="help-body">
            <div class="help-sidebar">
              <div class="help-search">
                <input type="text" id="help-search-input" placeholder="ヘルプを検索...">
                <button id="help-search-btn">🔍</button>
              </div>
              
              <div class="help-categories">
                <div class="help-category" data-category="getting_started">
                  <h4>はじめに</h4>
                  <ul class="help-category-items"></ul>
                </div>
                <div class="help-category" data-category="features">
                  <h4>機能</h4>
                  <ul class="help-category-items"></ul>
                </div>
                <div class="help-category" data-category="configuration">
                  <h4>設定</h4>
                  <ul class="help-category-items"></ul>
                </div>
                <div class="help-category" data-category="support">
                  <h4>サポート</h4>
                  <ul class="help-category-items"></ul>
                </div>
                <div class="help-category" data-category="tips">
                  <h4>ヒント</h4>
                  <ul class="help-category-items"></ul>
                </div>
                <div class="help-category" data-category="security">
                  <h4>セキュリティ</h4>
                  <ul class="help-category-items"></ul>
                </div>
              </div>
            </div>
            
            <div class="help-content">
              <div id="help-content-area">
                <div class="help-welcome">
                  <h3>ポップアップ広告ブロッカーへようこそ</h3>
                  <p>左側のカテゴリから知りたい項目を選択するか、上部の検索ボックスでヘルプを検索してください。</p>
                  
                  <div class="help-quick-links">
                    <h4>クイックリンク</h4>
                    <ul>
                      <li><a href="#" data-help-id="basic_usage">基本的な使い方</a></li>
                      <li><a href="#" data-help-id="popup_detection">ポップアップ検出について</a></li>
                      <li><a href="#" data-help-id="settings">設定について</a></li>
                      <li><a href="#" data-help-id="troubleshooting">トラブルシューティング</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="help-footer">
            <div class="help-footer-links">
              <a href="#" id="help-user-guide">ユーザーガイド</a>
              <a href="#" id="help-faq">FAQ</a>
              <a href="#" id="help-github">GitHub</a>
              <a href="#" id="help-report-issue">問題を報告</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // CSSスタイル
    const styleCSS = `
      <style>
        .help-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .help-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
        }
        
        .help-modal-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 1000px;
          height: 80%;
          max-height: 700px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
        }
        
        .help-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        }
        
        .help-header h2 {
          margin: 0;
          color: #333;
          font-size: 20px;
        }
        
        .help-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        .help-close-btn:hover {
          background: #e0e0e0;
        }
        
        .help-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        .help-sidebar {
          width: 300px;
          border-right: 1px solid #e0e0e0;
          background: #f8f9fa;
          overflow-y: auto;
        }
        
        .help-search {
          padding: 15px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
        }
        
        .help-search input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .help-search button {
          padding: 8px 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .help-categories {
          padding: 15px;
        }
        
        .help-category {
          margin-bottom: 20px;
        }
        
        .help-category h4 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 14px;
          font-weight: 600;
        }
        
        .help-category-items {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .help-category-items li {
          margin-bottom: 5px;
        }
        
        .help-category-items a {
          display: block;
          padding: 6px 12px;
          color: #666;
          text-decoration: none;
          border-radius: 4px;
          font-size: 13px;
          transition: background-color 0.2s;
        }
        
        .help-category-items a:hover,
        .help-category-items a.active {
          background: #007bff;
          color: white;
        }
        
        .help-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        
        .help-content h3 {
          color: #333;
          margin-top: 0;
        }
        
        .help-content h4 {
          color: #555;
          margin-top: 20px;
        }
        
        .help-content ul, .help-content ol {
          padding-left: 20px;
        }
        
        .help-content li {
          margin-bottom: 5px;
        }
        
        .help-tip {
          background: #e7f3ff;
          border: 1px solid #b3d9ff;
          border-radius: 4px;
          padding: 12px;
          margin: 15px 0;
        }
        
        .help-warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 12px;
          margin: 15px 0;
        }
        
        .help-security {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 4px;
          padding: 12px;
          margin: 15px 0;
        }
        
        .help-contact {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 12px;
          margin: 15px 0;
        }
        
        .help-quick-links ul {
          list-style: none;
          padding: 0;
        }
        
        .help-quick-links li {
          margin-bottom: 8px;
        }
        
        .help-quick-links a {
          color: #007bff;
          text-decoration: none;
        }
        
        .help-quick-links a:hover {
          text-decoration: underline;
        }
        
        .help-footer {
          border-top: 1px solid #e0e0e0;
          padding: 15px 20px;
          background: #f8f9fa;
          border-radius: 0 0 8px 8px;
        }
        
        .help-footer-links {
          display: flex;
          gap: 20px;
          justify-content: center;
        }
        
        .help-footer-links a {
          color: #007bff;
          text-decoration: none;
          font-size: 14px;
        }
        
        .help-footer-links a:hover {
          text-decoration: underline;
        }
        
        kbd {
          background: #f1f1f1;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 2px 6px;
          font-family: monospace;
          font-size: 12px;
        }
      </style>
    `;

    // DOMに追加
    document.head.insertAdjacentHTML('beforeend', styleCSS);
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.helpModal = document.getElementById('popup-blocker-help-modal');
    
    // カテゴリ項目を生成
    this.populateCategories();
  }

  /**
   * カテゴリ項目を生成
   */
  populateCategories() {
    const categories = {
      getting_started: [],
      features: [],
      configuration: [],
      support: [],
      tips: [],
      security: []
    };

    // ヘルプデータをカテゴリ別に分類
    for (const [id, data] of this.helpData.entries()) {
      if (categories[data.category]) {
        categories[data.category].push({ id, title: data.title });
      }
    }

    // 各カテゴリにアイテムを追加
    for (const [category, items] of Object.entries(categories)) {
      const categoryElement = document.querySelector(`[data-category="${category}"] .help-category-items`);
      if (categoryElement) {
        categoryElement.innerHTML = items.map(item => 
          `<li><a href="#" data-help-id="${item.id}">${item.title}</a></li>`
        ).join('');
      }
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    if (!this.helpModal) return;

    // モーダルを閉じる
    const closeBtn = this.helpModal.querySelector('.help-close-btn');
    const overlay = this.helpModal.querySelector('.help-modal-overlay');
    
    closeBtn?.addEventListener('click', () => this.hideHelp());
    overlay?.addEventListener('click', () => this.hideHelp());

    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.helpModal.style.display !== 'none') {
        this.hideHelp();
      }
    });

    // ヘルプ項目のクリック
    this.helpModal.addEventListener('click', (e) => {
      if (e.target.matches('[data-help-id]')) {
        e.preventDefault();
        const helpId = e.target.getAttribute('data-help-id');
        this.showHelpContent(helpId);
        
        // アクティブ状態を更新
        this.helpModal.querySelectorAll('[data-help-id]').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
      }
    });

    // 検索機能
    const searchInput = this.helpModal.querySelector('#help-search-input');
    const searchBtn = this.helpModal.querySelector('#help-search-btn');
    
    searchBtn?.addEventListener('click', () => this.performSearch());
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // フッターリンク
    const userGuideLink = this.helpModal.querySelector('#help-user-guide');
    const faqLink = this.helpModal.querySelector('#help-faq');
    const githubLink = this.helpModal.querySelector('#help-github');
    const reportIssueLink = this.helpModal.querySelector('#help-report-issue');

    userGuideLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('docs/USER_GUIDE.md');
    });

    faqLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('docs/FAQ.md');
    });

    githubLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('https://github.com/your-username/chrome-popup-ad-blocker');
    });

    reportIssueLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('https://github.com/your-username/chrome-popup-ad-blocker/issues');
    });
  }

  /**
   * ヘルプを表示
   */
  showHelp(context = null) {
    if (!this.helpModal) return;

    this.currentContext = context;
    this.helpModal.style.display = 'block';
    
    // コンテキストに応じた初期表示
    if (context) {
      this.showHelpContent(context);
    }

    this.logger.info('HELP_SYSTEM', 'ヘルプを表示しました', { context });
  }

  /**
   * ヘルプを非表示
   */
  hideHelp() {
    if (!this.helpModal) return;

    this.helpModal.style.display = 'none';
    this.currentContext = null;

    this.logger.info('HELP_SYSTEM', 'ヘルプを非表示にしました');
  }

  /**
   * ヘルプコンテンツを表示
   */
  showHelpContent(helpId) {
    const helpData = this.helpData.get(helpId);
    if (!helpData) {
      this.logger.warn('HELP_SYSTEM', 'ヘルプデータが見つかりません', { helpId });
      return;
    }

    const contentArea = this.helpModal.querySelector('#help-content-area');
    if (contentArea) {
      contentArea.innerHTML = helpData.content;
    }

    this.logger.debug('HELP_SYSTEM', 'ヘルプコンテンツを表示しました', { helpId });
  }

  /**
   * 検索を実行
   */
  performSearch() {
    const searchInput = this.helpModal.querySelector('#help-search-input');
    const query = searchInput?.value.trim().toLowerCase();
    
    if (!query) return;

    const results = this.searchHelp(query);
    this.displaySearchResults(query, results);

    this.logger.debug('HELP_SYSTEM', '検索を実行しました', { query, resultCount: results.length });
  }

  /**
   * ヘルプを検索
   */
  searchHelp(query) {
    const words = query.split(/\s+/);
    const resultScores = new Map();

    for (const word of words) {
      if (this.searchIndex.has(word)) {
        for (const helpId of this.searchIndex.get(word)) {
          const currentScore = resultScores.get(helpId) || 0;
          resultScores.set(helpId, currentScore + 1);
        }
      }
    }

    // スコア順にソート
    const sortedResults = Array.from(resultScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([helpId]) => helpId);

    return sortedResults;
  }

  /**
   * 検索結果を表示
   */
  displaySearchResults(query, results) {
    const contentArea = this.helpModal.querySelector('#help-content-area');
    if (!contentArea) return;

    let html = `<h3>検索結果: "${query}"</h3>`;

    if (results.length === 0) {
      html += `
        <p>検索結果が見つかりませんでした。</p>
        <div class="help-tip">
          💡 <strong>ヒント</strong>: 別のキーワードで検索するか、左側のカテゴリから探してみてください。
        </div>
      `;
    } else {
      html += '<div class="search-results">';
      for (const helpId of results) {
        const helpData = this.helpData.get(helpId);
        if (helpData) {
          html += `
            <div class="search-result-item">
              <h4><a href="#" data-help-id="${helpId}">${helpData.title}</a></h4>
              <p>${this.extractSnippet(helpData.content, query)}</p>
            </div>
          `;
        }
      }
      html += '</div>';
    }

    contentArea.innerHTML = html;
  }

  /**
   * 検索結果のスニペットを抽出
   */
  extractSnippet(content, query) {
    const textContent = content.replace(/<[^>]*>/g, '');
    const words = query.split(/\s+/);
    
    for (const word of words) {
      const index = textContent.toLowerCase().indexOf(word.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(textContent.length, index + 100);
        let snippet = textContent.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < textContent.length) snippet = snippet + '...';
        
        return snippet;
      }
    }
    
    return textContent.substring(0, 150) + '...';
  }

  /**
   * 外部リンクを開く
   */
  openExternalLink(url) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * コンテキストヘルプを表示
   */
  showContextHelp(element) {
    const helpId = element.getAttribute('data-help-context');
    if (helpId) {
      this.showHelp(helpId);
    }
  }

  /**
   * ヘルプボタンを追加
   */
  addHelpButton(container, helpId, text = '?') {
    const helpButton = document.createElement('button');
    helpButton.textContent = text;
    helpButton.className = 'help-button';
    helpButton.style.cssText = `
      background: #007bff;
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    `;
    
    helpButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp(helpId);
    });
    
    container.appendChild(helpButton);
    return helpButton;
  }

  /**
   * ツールチップヘルプを追加
   */
  addTooltipHelp(element, helpText) {
    element.title = helpText;
    element.style.cursor = 'help';
    
    // より詳細なツールチップ（オプション）
    element.addEventListener('mouseenter', (e) => {
      this.showTooltip(e.target, helpText);
    });
    
    element.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * ツールチップを表示
   */
  showTooltip(element, text) {
    // 既存のツールチップを削除
    this.hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'popup-blocker-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: #333;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 999999;
      max-width: 200px;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(tooltip);
    
    // 位置を調整
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 5) + 'px';
  }

  /**
   * ツールチップを非表示
   */
  hideTooltip() {
    const tooltip = document.getElementById('popup-blocker-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * ヘルプシステムを破棄
   */
  destroy() {
    if (this.helpModal) {
      this.helpModal.remove();
    }
    
    this.hideTooltip();
    
    this.logger.info('HELP_SYSTEM', 'ヘルプシステムを破棄しました');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HelpSystem };
} else if (typeof window !== 'undefined') {
  window.HelpSystem = HelpSystem;
}