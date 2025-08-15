/**
 * PrivacyManager - プライバシー保護機能管理クラス
 * 広告プレビューシステムにおけるプライバシー保護機能を提供
 */

class PrivacyManager {
  constructor(options = {}) {
    this.options = {
      // 画像保存設定
      temporaryStorageEnabled: options.temporaryStorageEnabled !== false,
      autoDeleteOnDialogClose: options.autoDeleteOnDialogClose !== false,
      maxStorageTime: options.maxStorageTime || 300000, // 5分
      
      // 機密サイト検出設定
      sensitiveDomainsEnabled: options.sensitiveDomainsEnabled !== false,
      customSensitiveDomains: options.customSensitiveDomains || [],
      
      // 個人情報検出設定
      personalInfoDetectionEnabled: options.personalInfoDetectionEnabled !== false,
      blurSensitiveContent: options.blurSensitiveContent !== false,
      blurIntensity: options.blurIntensity || 10,
      
      // プライバシー設定
      privacyLevel: options.privacyLevel || 'medium', // low, medium, high
      userConsent: options.userConsent || false,
      
      // デバッグ設定
      debugMode: options.debugMode || false,
      
      ...options
    };

    // 内部状態
    this.temporaryImages = new Map();
    this.sensitiveElements = new Set();
    this.privacySettings = this.loadPrivacySettings();
    this.initialized = false;

    // 機密サイトのデフォルトリスト
    this.defaultSensitiveDomains = [
      // 銀行・金融機関
      'bank', 'banking', 'credit', 'loan', 'finance', 'investment',
      'paypal.com', 'stripe.com', 'square.com',
      
      // 医療・健康
      'hospital', 'clinic', 'medical', 'health', 'patient',
      'webmd.com', 'mayoclinic.org',
      
      // 政府・公的機関
      'gov', 'government', 'irs.gov', 'ssa.gov',
      
      // 法律・法的サービス
      'law', 'legal', 'attorney', 'lawyer',
      
      // 個人情報を扱うサービス
      'hr', 'payroll', 'personnel', 'employee'
    ];

    // 個人情報検出パターン
    this.personalInfoPatterns = {
      // 電話番号
      phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
      
      // メールアドレス
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      
      // 住所（簡易版）
      address: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)/gi,
      
      // クレジットカード番号（簡易版）
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      
      // 社会保障番号（米国）
      ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      
      // 日本の郵便番号
      zipCodeJP: /\b\d{3}-?\d{4}\b/g,
      
      // 日本の電話番号
      phoneJP: /\b0\d{1,4}-?\d{1,4}-?\d{4}\b/g
    };

    // バインドされたメソッド
    this.checkSensitiveSite = this.checkSensitiveSite.bind(this);
    this.detectPersonalInfo = this.detectPersonalInfo.bind(this);
    this.applyPrivacyProtection = this.applyPrivacyProtection.bind(this);
    this.storeTemporaryImage = this.storeTemporaryImage.bind(this);
    this.cleanupTemporaryImages = this.cleanupTemporaryImages.bind(this);

    // 初期化
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    try {
      // プライバシー設定の読み込み
      await this.loadPrivacySettings();
      
      // 自動クリーンアップの設定
      this.setupAutoCleanup();
      
      // ページアンロード時のクリーンアップ設定
      this.setupUnloadCleanup();
      
      // ダイアログ閉じ時のクリーンアップ設定
      this.setupDialogCleanup();
      
      this.initialized = true;
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Initialized successfully', {
          privacyLevel: this.options.privacyLevel,
          temporaryStorageEnabled: this.options.temporaryStorageEnabled,
          sensitiveDomainsEnabled: this.options.sensitiveDomainsEnabled,
          personalInfoDetectionEnabled: this.options.personalInfoDetectionEnabled
        });
      }
      
    } catch (error) {
      console.error('PrivacyManager: Initialization error:', error);
    }
  }

  /**
   * プライバシー設定の読み込み
   */
  async loadPrivacySettings() {
    try {
      // ローカルストレージからプライバシー設定を読み込み
      const stored = localStorage.getItem('adPreviewPrivacySettings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.privacySettings = {
          ...this.getDefaultPrivacySettings(),
          ...settings
        };
      } else {
        this.privacySettings = this.getDefaultPrivacySettings();
      }
      
      // 設定に基づいてオプションを更新
      this.updateOptionsFromSettings();
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Privacy settings loaded', this.privacySettings);
      }
      
    } catch (error) {
      console.error('PrivacyManager: Failed to load privacy settings:', error);
      this.privacySettings = this.getDefaultPrivacySettings();
    }
  }

  /**
   * デフォルトプライバシー設定を取得
   */
  getDefaultPrivacySettings() {
    return {
      privacyLevel: 'medium',
      temporaryStorageEnabled: true,
      autoDeleteOnDialogClose: true,
      maxStorageTime: 300000, // 5分
      sensitiveDomainsEnabled: true,
      personalInfoDetectionEnabled: true,
      blurSensitiveContent: true,
      blurIntensity: 10,
      userConsent: false,
      customSensitiveDomains: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * 設定からオプションを更新
   */
  updateOptionsFromSettings() {
    Object.keys(this.privacySettings).forEach(key => {
      if (key in this.options) {
        this.options[key] = this.privacySettings[key];
      }
    });
  }

  /**
   * プライバシー設定を保存
   */
  async savePrivacySettings(newSettings = {}) {
    try {
      this.privacySettings = {
        ...this.privacySettings,
        ...newSettings,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem('adPreviewPrivacySettings', JSON.stringify(this.privacySettings));
      this.updateOptionsFromSettings();
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Privacy settings saved', this.privacySettings);
      }
      
    } catch (error) {
      console.error('PrivacyManager: Failed to save privacy settings:', error);
    }
  }

  /**
   * 自動クリーンアップの設定
   */
  setupAutoCleanup() {
    // 定期的な自動クリーンアップ
    setInterval(() => {
      this.cleanupExpiredImages();
    }, 60000); // 1分間隔
    
    // メモリ使用量チェック
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // 30秒間隔
  }

  /**
   * ページアンロード時のクリーンアップ設定
   */
  setupUnloadCleanup() {
    window.addEventListener('beforeunload', () => {
      this.performEmergencyCleanup();
    });
    
    window.addEventListener('unload', () => {
      this.performEmergencyCleanup();
    });
    
    // ページの可視性変更時のクリーンアップ
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performBackgroundCleanup();
      }
    });
  }

  /**
   * ダイアログ閉じ時のクリーンアップ設定
   */
  setupDialogCleanup() {
    // MutationObserverでダイアログの削除を監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // ユーザー選択ダイアログが削除された場合
            if (node.classList && (
              node.classList.contains('user-choice-dialog') ||
              node.classList.contains('preview-gallery') ||
              node.id === 'adPreviewDialog'
            )) {
              this.onDialogClosed();
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * ダイアログ閉じ時の処理
   */
  onDialogClosed() {
    if (this.options.autoDeleteOnDialogClose) {
      this.cleanupTemporaryImages();
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Dialog closed, temporary images cleaned up');
      }
    }
  }

  /**
   * 機密サイトかどうかをチェック
   */
  checkSensitiveSite(url = window.location.href) {
    if (!this.options.sensitiveDomainsEnabled) {
      return { isSensitive: false, reason: 'disabled' };
    }
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();
      const fullUrl = `${hostname}${pathname}`;
      
      // カスタム機密ドメインをチェック
      const customDomains = [
        ...this.options.customSensitiveDomains,
        ...this.privacySettings.customSensitiveDomains
      ];
      
      for (const domain of customDomains) {
        if (hostname.includes(domain.toLowerCase()) || fullUrl.includes(domain.toLowerCase())) {
          return {
            isSensitive: true,
            reason: 'custom_domain',
            matchedDomain: domain,
            action: 'disable_preview'
          };
        }
      }
      
      // デフォルト機密ドメインをチェック
      for (const domain of this.defaultSensitiveDomains) {
        if (hostname.includes(domain.toLowerCase()) || fullUrl.includes(domain.toLowerCase())) {
          return {
            isSensitive: true,
            reason: 'default_domain',
            matchedDomain: domain,
            action: this.getSensitiveSiteAction(domain)
          };
        }
      }
      
      // HTTPSでない金融・医療関連サイト
      if (urlObj.protocol !== 'https:' && this.isFinancialOrMedical(hostname)) {
        return {
          isSensitive: true,
          reason: 'insecure_sensitive',
          action: 'disable_preview'
        };
      }
      
      return { isSensitive: false };
      
    } catch (error) {
      console.error('PrivacyManager: Error checking sensitive site:', error);
      return { isSensitive: false, error: error.message };
    }
  }

  /**
   * 金融・医療関連サイトかどうかをチェック
   */
  isFinancialOrMedical(hostname) {
    const financialMedicalKeywords = [
      'bank', 'credit', 'loan', 'finance', 'medical', 'health', 'hospital', 'clinic'
    ];
    
    return financialMedicalKeywords.some(keyword => 
      hostname.includes(keyword.toLowerCase())
    );
  }

  /**
   * 機密サイトに対するアクションを取得
   */
  getSensitiveSiteAction(domain) {
    // プライバシーレベルに基づいてアクションを決定
    switch (this.options.privacyLevel) {
      case 'high':
        return 'disable_preview';
      case 'medium':
        return domain.includes('bank') || domain.includes('medical') ? 'disable_preview' : 'blur_preview';
      case 'low':
        return 'blur_preview';
      default:
        return 'blur_preview';
    }
  }

  /**
   * 要素内の個人情報を検出
   */
  detectPersonalInfo(element) {
    if (!this.options.personalInfoDetectionEnabled) {
      return { hasPersonalInfo: false, reason: 'disabled' };
    }
    
    try {
      const textContent = this.extractTextContent(element);
      const detectedInfo = [];
      
      // 各パターンで個人情報を検出
      Object.entries(this.personalInfoPatterns).forEach(([type, pattern]) => {
        const matches = textContent.match(pattern);
        if (matches && matches.length > 0) {
          detectedInfo.push({
            type: type,
            matches: matches.length,
            examples: matches.slice(0, 2) // 最初の2つの例のみ記録
          });
        }
      });
      
      // 特定の属性値もチェック
      const sensitiveAttributes = this.checkSensitiveAttributes(element);
      if (sensitiveAttributes.length > 0) {
        detectedInfo.push({
          type: 'sensitive_attributes',
          attributes: sensitiveAttributes
        });
      }
      
      const hasPersonalInfo = detectedInfo.length > 0;
      
      if (hasPersonalInfo && this.options.debugMode) {
        console.log('PrivacyManager: Personal info detected', {
          element: element.tagName,
          detectedInfo: detectedInfo
        });
      }
      
      return {
        hasPersonalInfo: hasPersonalInfo,
        detectedInfo: detectedInfo,
        action: hasPersonalInfo ? this.getPersonalInfoAction() : null
      };
      
    } catch (error) {
      console.error('PrivacyManager: Error detecting personal info:', error);
      return { hasPersonalInfo: false, error: error.message };
    }
  }

  /**
   * 要素からテキストコンテンツを抽出
   */
  extractTextContent(element) {
    try {
      // 表示されているテキストのみを取得
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let textContent = '';
      let node;
      while (node = walker.nextNode()) {
        textContent += node.textContent + ' ';
      }
      
      return textContent.trim();
      
    } catch (error) {
      // フォールバック：単純なtextContentを使用
      return element.textContent || '';
    }
  }

  /**
   * 機密属性をチェック
   */
  checkSensitiveAttributes(element) {
    const sensitiveAttributes = [];
    const attributesToCheck = ['data-user-id', 'data-email', 'data-phone', 'data-ssn', 'data-credit-card'];
    
    attributesToCheck.forEach(attr => {
      if (element.hasAttribute(attr)) {
        sensitiveAttributes.push(attr);
      }
    });
    
    // input要素の特別チェック
    if (element.tagName === 'INPUT') {
      const type = element.type.toLowerCase();
      const name = element.name.toLowerCase();
      
      if (['email', 'tel', 'password'].includes(type)) {
        sensitiveAttributes.push(`input-type-${type}`);
      }
      
      if (['email', 'phone', 'ssn', 'credit', 'card'].some(keyword => name.includes(keyword))) {
        sensitiveAttributes.push(`input-name-${name}`);
      }
    }
    
    return sensitiveAttributes;
  }

  /**
   * 個人情報検出時のアクションを取得
   */
  getPersonalInfoAction() {
    switch (this.options.privacyLevel) {
      case 'high':
        return 'disable_preview';
      case 'medium':
        return 'blur_preview';
      case 'low':
        return 'blur_preview';
      default:
        return 'blur_preview';
    }
  }

  /**
   * プライバシー保護を適用
   */
  async applyPrivacyProtection(element, previewData) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      const protectionResult = {
        originalData: previewData,
        protectedData: { ...previewData },
        protections: [],
        blocked: false
      };
      
      // 機密サイトチェック
      const siteCheck = this.checkSensitiveSite();
      if (siteCheck.isSensitive) {
        protectionResult.protections.push({
          type: 'sensitive_site',
          reason: siteCheck.reason,
          action: siteCheck.action
        });
        
        if (siteCheck.action === 'disable_preview') {
          protectionResult.blocked = true;
          protectionResult.protectedData = this.createBlockedPreview(element, 'sensitive_site');
          return protectionResult;
        }
      }
      
      // 個人情報検出
      const personalInfoCheck = this.detectPersonalInfo(element);
      if (personalInfoCheck.hasPersonalInfo) {
        protectionResult.protections.push({
          type: 'personal_info',
          detectedInfo: personalInfoCheck.detectedInfo,
          action: personalInfoCheck.action
        });
        
        if (personalInfoCheck.action === 'disable_preview') {
          protectionResult.blocked = true;
          protectionResult.protectedData = this.createBlockedPreview(element, 'personal_info');
          return protectionResult;
        }
      }
      
      // ぼかし処理が必要な場合
      const needsBlur = protectionResult.protections.some(p => p.action === 'blur_preview');
      if (needsBlur && this.options.blurSensitiveContent) {
        protectionResult.protectedData = await this.applyBlurEffect(previewData);
        protectionResult.protections.push({
          type: 'blur_applied',
          intensity: this.options.blurIntensity
        });
      }
      
      // 一時保存の処理
      if (this.options.temporaryStorageEnabled && !protectionResult.blocked) {
        this.storeTemporaryImage(protectionResult.protectedData);
      }
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Privacy protection applied', {
          element: element.tagName,
          protections: protectionResult.protections,
          blocked: protectionResult.blocked
        });
      }
      
      return protectionResult;
      
    } catch (error) {
      console.error('PrivacyManager: Error applying privacy protection:', error);
      return {
        originalData: previewData,
        protectedData: previewData,
        protections: [],
        blocked: false,
        error: error.message
      };
    }
  }

  /**
   * ブロックされたプレビューを作成
   */
  createBlockedPreview(element, reason) {
    const reasonMessages = {
      sensitive_site: '機密サイトのため、プライバシー保護によりプレビューが無効化されています',
      personal_info: '個人情報が検出されたため、プライバシー保護によりプレビューが無効化されています'
    };
    
    return {
      id: `blocked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      element: element,
      blocked: true,
      blockReason: reason,
      fallback: {
        type: 'privacy_blocked',
        reason: reasonMessages[reason] || 'プライバシー保護により無効化',
        description: this.getElementDescription(element),
        icon: '🔒'
      },
      elementInfo: this.getBasicElementInfo(element),
      timestamp: Date.now()
    };
  }

  /**
   * 要素の基本情報を取得
   */
  getBasicElementInfo(element) {
    try {
      const rect = element.getBoundingClientRect();
      return {
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        size: {
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        position: {
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        }
      };
    } catch (error) {
      return {
        tagName: element.tagName || 'UNKNOWN',
        className: '',
        id: '',
        size: { width: 0, height: 0 },
        position: { x: 0, y: 0 }
      };
    }
  }

  /**
   * 要素の説明を取得
   */
  getElementDescription(element) {
    try {
      const tagName = element.tagName.toLowerCase();
      const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
      const id = element.id ? `#${element.id}` : '';
      
      return `${tagName}${id}${className}`;
    } catch (error) {
      return 'Unknown element';
    }
  }

  /**
   * ぼかし効果を適用
   */
  async applyBlurEffect(previewData) {
    try {
      if (!previewData.screenshot) {
        return previewData;
      }
      
      const blurredData = { ...previewData };
      
      // サムネイルにぼかし効果を適用
      if (previewData.screenshot.thumbnail) {
        blurredData.screenshot.thumbnail = await this.blurImage(
          previewData.screenshot.thumbnail,
          this.options.blurIntensity
        );
      }
      
      // フルサイズ画像にぼかし効果を適用
      if (previewData.screenshot.fullSize) {
        blurredData.screenshot.fullSize = await this.blurImage(
          previewData.screenshot.fullSize,
          this.options.blurIntensity
        );
      }
      
      // ぼかし情報を追加
      blurredData.privacyProtection = {
        blurred: true,
        intensity: this.options.blurIntensity,
        timestamp: Date.now()
      };
      
      return blurredData;
      
    } catch (error) {
      console.error('PrivacyManager: Error applying blur effect:', error);
      return previewData;
    }
  }

  /**
   * 画像にぼかし効果を適用
   */
  async blurImage(imageDataUrl, intensity) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          // ぼかしフィルターを適用
          ctx.filter = `blur(${intensity}px)`;
          ctx.drawImage(img, 0, 0);
          
          // 結果を取得
          const blurredDataUrl = canvas.toDataURL('image/png', 0.8);
          resolve(blurredDataUrl);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image for blurring'));
        };
        
        img.src = imageDataUrl;
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 一時画像を保存
   */
  storeTemporaryImage(previewData) {
    if (!this.options.temporaryStorageEnabled) {
      return;
    }
    
    try {
      const imageId = previewData.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.temporaryImages.set(imageId, {
        data: previewData,
        timestamp: Date.now(),
        accessCount: 0
      });
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Temporary image stored', {
          imageId: imageId,
          totalStored: this.temporaryImages.size
        });
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error storing temporary image:', error);
    }
  }

  /**
   * 一時画像をクリーンアップ
   */
  cleanupTemporaryImages(imageIds = null) {
    try {
      if (imageIds) {
        // 特定の画像のみクリーンアップ
        const idsToClean = Array.isArray(imageIds) ? imageIds : [imageIds];
        idsToClean.forEach(id => {
          this.temporaryImages.delete(id);
        });
        
        if (this.options.debugMode) {
          console.log('PrivacyManager: Specific temporary images cleaned up', {
            cleanedIds: idsToClean,
            remaining: this.temporaryImages.size
          });
        }
      } else {
        // すべての一時画像をクリーンアップ
        const cleanedCount = this.temporaryImages.size;
        this.temporaryImages.clear();
        
        if (this.options.debugMode) {
          console.log('PrivacyManager: All temporary images cleaned up', {
            cleanedCount: cleanedCount
          });
        }
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error cleaning up temporary images:', error);
    }
  }

  /**
   * 期限切れ画像をクリーンアップ
   */
  cleanupExpiredImages() {
    try {
      const now = Date.now();
      const expiredIds = [];
      
      this.temporaryImages.forEach((imageData, imageId) => {
        if (now - imageData.timestamp > this.options.maxStorageTime) {
          expiredIds.push(imageId);
        }
      });
      
      if (expiredIds.length > 0) {
        this.cleanupTemporaryImages(expiredIds);
        
        if (this.options.debugMode) {
          console.log('PrivacyManager: Expired images cleaned up', {
            expiredCount: expiredIds.length
          });
        }
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error cleaning up expired images:', error);
    }
  }

  /**
   * メモリ使用量をチェック
   */
  checkMemoryUsage() {
    try {
      const imageCount = this.temporaryImages.size;
      const memoryThreshold = 50; // 50個の画像を閾値とする
      
      if (imageCount > memoryThreshold) {
        // 古い画像から削除
        const sortedImages = Array.from(this.temporaryImages.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toDelete = sortedImages.slice(0, Math.floor(imageCount * 0.3)); // 30%削除
        const idsToDelete = toDelete.map(([id]) => id);
        
        this.cleanupTemporaryImages(idsToDelete);
        
        if (this.options.debugMode) {
          console.log('PrivacyManager: Memory cleanup performed', {
            originalCount: imageCount,
            deletedCount: idsToDelete.length,
            remainingCount: this.temporaryImages.size
          });
        }
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error checking memory usage:', error);
    }
  }

  /**
   * 緊急クリーンアップ
   */
  performEmergencyCleanup() {
    try {
      this.cleanupTemporaryImages();
      this.sensitiveElements.clear();
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Emergency cleanup performed');
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error performing emergency cleanup:', error);
    }
  }

  /**
   * バックグラウンドクリーンアップ
   */
  performBackgroundCleanup() {
    try {
      // ページが非表示になった時の軽いクリーンアップ
      this.cleanupExpiredImages();
      
      if (this.options.debugMode) {
        console.log('PrivacyManager: Background cleanup performed');
      }
      
    } catch (error) {
      console.error('PrivacyManager: Error performing background cleanup:', error);
    }
  }

  /**
   * プライバシー設定を取得
   */
  getPrivacySettings() {
    return { ...this.privacySettings };
  }

  /**
   * プライバシー設定を更新
   */
  async updatePrivacySettings(newSettings) {
    await this.savePrivacySettings(newSettings);
    
    if (this.options.debugMode) {
      console.log('PrivacyManager: Privacy settings updated', newSettings);
    }
  }

  /**
   * プライバシー統計を取得
   */
  getPrivacyStats() {
    return {
      temporaryImagesCount: this.temporaryImages.size,
      sensitiveElementsCount: this.sensitiveElements.size,
      privacyLevel: this.options.privacyLevel,
      protectionEnabled: {
        temporaryStorage: this.options.temporaryStorageEnabled,
        sensitiveDomainsEnabled: this.options.sensitiveDomainsEnabled,
        personalInfoDetection: this.options.personalInfoDetectionEnabled,
        blurSensitiveContent: this.options.blurSensitiveContent
      }
    };
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      options: this.options,
      privacySettings: this.privacySettings,
      stats: this.getPrivacyStats(),
      temporaryImages: Array.from(this.temporaryImages.keys()),
      sensitiveElements: Array.from(this.sensitiveElements)
    };
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.PrivacyManager = PrivacyManager;
}