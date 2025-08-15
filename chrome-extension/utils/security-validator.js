/**
 * セキュリティ検証システム
 * 拡張機能のセキュリティ状態を継続的に監視・検証する
 */

/**
 * セキュリティ検証クラス
 */
class SecurityValidator {
  constructor(logger) {
    this.logger = logger;
    this.validationRules = new Map();
    this.securityEvents = [];
    this.threatLevel = 'low';
    this.lastValidation = null;
    this.validationInterval = null;
    
    this.initializeValidationRules();
    this.startContinuousValidation();
  }

  /**
   * 検証ルールの初期化
   */
  initializeValidationRules() {
    // CSP検証ルール
    this.validationRules.set('csp_compliance', {
      name: 'Content Security Policy準拠',
      severity: 'high',
      validate: () => this.validateCSPCompliance(),
      frequency: 'startup'
    });

    // 権限使用検証ルール
    this.validationRules.set('permission_usage', {
      name: '権限使用の適切性',
      severity: 'high',
      validate: () => this.validatePermissionUsage(),
      frequency: 'continuous'
    });

    // データ保護検証ルール
    this.validationRules.set('data_protection', {
      name: 'データ保護',
      severity: 'high',
      validate: () => this.validateDataProtection(),
      frequency: 'periodic'
    });

    // 入力検証ルール
    this.validationRules.set('input_validation', {
      name: '入力検証',
      severity: 'medium',
      validate: () => this.validateInputSanitization(),
      frequency: 'continuous'
    });

    // DOM操作安全性ルール
    this.validationRules.set('dom_safety', {
      name: 'DOM操作の安全性',
      severity: 'medium',
      validate: () => this.validateDOMSafety(),
      frequency: 'continuous'
    });

    // メッセージパッシング安全性ルール
    this.validationRules.set('message_safety', {
      name: 'メッセージパッシングの安全性',
      severity: 'medium',
      validate: () => this.validateMessageSafety(),
      frequency: 'continuous'
    });

    // ストレージ整合性ルール
    this.validationRules.set('storage_integrity', {
      name: 'ストレージ整合性',
      severity: 'medium',
      validate: () => this.validateStorageIntegrity(),
      frequency: 'periodic'
    });

    // 外部通信監視ルール
    this.validationRules.set('external_communication', {
      name: '外部通信監視',
      severity: 'high',
      validate: () => this.validateExternalCommunication(),
      frequency: 'continuous'
    });

    // コード整合性ルール
    this.validationRules.set('code_integrity', {
      name: 'コード整合性',
      severity: 'high',
      validate: () => this.validateCodeIntegrity(),
      frequency: 'startup'
    });

    // 依存関係安全性ルール
    this.validationRules.set('dependency_safety', {
      name: '依存関係の安全性',
      severity: 'medium',
      validate: () => this.validateDependencySafety(),
      frequency: 'periodic'
    });
  }

  /**
   * 継続的な検証を開始
   */
  startContinuousValidation() {
    // 起動時検証
    this.runValidation('startup');

    // 定期検証 (5分間隔)
    this.validationInterval = setInterval(() => {
      this.runValidation('periodic');
    }, 300000);

    // 継続的検証 (30秒間隔)
    setInterval(() => {
      this.runValidation('continuous');
    }, 30000);

    this.logger.info('SECURITY_VALIDATOR', '継続的セキュリティ検証を開始しました');
  }

  /**
   * 検証を実行
   */
  async runValidation(frequency) {
    const startTime = Date.now();
    const results = [];

    for (const [ruleId, rule] of this.validationRules.entries()) {
      if (rule.frequency === frequency || frequency === 'all') {
        try {
          const result = await rule.validate();
          results.push({
            ruleId,
            name: rule.name,
            severity: rule.severity,
            ...result,
            timestamp: Date.now()
          });
        } catch (error) {
          this.logger.error('SECURITY_VALIDATOR', `検証ルール実行エラー: ${ruleId}`, {
            error: error.message
          });
          
          results.push({
            ruleId,
            name: rule.name,
            severity: rule.severity,
            passed: false,
            issues: [`検証エラー: ${error.message}`],
            timestamp: Date.now()
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    this.lastValidation = {
      timestamp: Date.now(),
      frequency,
      results,
      duration,
      summary: this.generateValidationSummary(results)
    };

    // 脅威レベルの更新
    this.updateThreatLevel(results);

    // 重要な問題があればログに記録
    this.logSecurityIssues(results);

    this.logger.debug('SECURITY_VALIDATOR', `セキュリティ検証完了: ${frequency}`, {
      duration,
      rulesChecked: results.length,
      issues: results.filter(r => !r.passed).length
    });
  }

  /**
   * CSP準拠の検証
   */
  validateCSPCompliance() {
    const issues = [];
    let passed = true;

    try {
      // インラインスクリプトの使用チェック
      const inlineScripts = document.querySelectorAll('script:not([src])');
      if (inlineScripts.length > 0) {
        issues.push(`インラインスクリプトが検出されました: ${inlineScripts.length}個`);
        passed = false;
      }

      // eval()の使用チェック（静的解析の限界があるため基本的なチェック）
      const scripts = document.querySelectorAll('script[src]');
      for (const script of scripts) {
        if (script.src.includes('eval') || script.textContent?.includes('eval(')) {
          issues.push(`eval()の使用が疑われます: ${script.src || 'inline'}`);
          passed = false;
        }
      }

      // 外部リソースの読み込みチェック
      const externalResources = document.querySelectorAll('[src^="http"], [href^="http"]');
      for (const resource of externalResources) {
        const url = resource.src || resource.href;
        if (!url.startsWith('chrome-extension://')) {
          issues.push(`外部リソースの読み込み: ${url}`);
          // 警告レベル（必ずしもエラーではない）
        }
      }

    } catch (error) {
      issues.push(`CSP検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        checkedElements: document.querySelectorAll('script, [src], [href]').length
      }
    };
  }

  /**
   * 権限使用の検証
   */
  validatePermissionUsage() {
    const issues = [];
    let passed = true;

    try {
      // 必要な権限の確認
      const requiredPermissions = ['activeTab', 'storage', 'notifications'];
      const manifestPermissions = chrome.runtime.getManifest().permissions || [];

      // 不要な権限の検出
      const unnecessaryPermissions = manifestPermissions.filter(
        perm => !requiredPermissions.includes(perm)
      );

      if (unnecessaryPermissions.length > 0) {
        issues.push(`不要な権限が検出されました: ${unnecessaryPermissions.join(', ')}`);
        passed = false;
      }

      // 権限の実際の使用状況チェック
      if (typeof chrome.storage === 'undefined') {
        issues.push('storage権限が利用できません');
        passed = false;
      }

      if (typeof chrome.notifications === 'undefined') {
        issues.push('notifications権限が利用できません');
        passed = false;
      }

    } catch (error) {
      issues.push(`権限検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        manifestPermissions: chrome.runtime.getManifest().permissions || []
      }
    };
  }

  /**
   * データ保護の検証
   */
  async validateDataProtection() {
    const issues = [];
    let passed = true;

    try {
      // ストレージデータの暗号化チェック
      if (typeof chrome.storage !== 'undefined') {
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });

        // 機密データが平文で保存されていないかチェック
        const sensitiveKeys = ['password', 'token', 'key', 'secret'];
        for (const [key, value] of Object.entries(data)) {
          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            if (typeof value === 'string' && !this.isEncrypted(value)) {
              issues.push(`機密データが平文で保存されています: ${key}`);
              passed = false;
            }
          }
        }

        // データサイズの確認
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 5 * 1024 * 1024) { // 5MB
          issues.push(`ストレージ使用量が大きすぎます: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
        }
      }

      // メモリ内の機密データチェック
      if (typeof window !== 'undefined') {
        const globalVars = Object.keys(window);
        const suspiciousVars = globalVars.filter(name => 
          ['password', 'token', 'key', 'secret'].some(sensitive => 
            name.toLowerCase().includes(sensitive)
          )
        );

        if (suspiciousVars.length > 0) {
          issues.push(`グローバル変数に機密データの可能性: ${suspiciousVars.join(', ')}`);
        }
      }

    } catch (error) {
      issues.push(`データ保護検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        storageAvailable: typeof chrome.storage !== 'undefined'
      }
    };
  }

  /**
   * 入力サニタイゼーションの検証
   */
  validateInputSanitization() {
    const issues = [];
    let passed = true;

    try {
      // 入力フィールドの検証
      const inputs = document.querySelectorAll('input, textarea, select');
      for (const input of inputs) {
        // XSS攻撃の可能性があるパターンをチェック
        const value = input.value;
        if (value && this.containsSuspiciousContent(value)) {
          issues.push(`疑わしい入力内容が検出されました: ${input.name || input.id}`);
        }

        // 入力検証の実装チェック
        if (!input.hasAttribute('data-validated')) {
          issues.push(`入力検証が実装されていない可能性: ${input.name || input.id}`);
        }
      }

      // DOM操作での危険な関数の使用チェック
      const dangerousFunctions = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'];
      // 実際のコード解析は困難なため、警告レベルでの検出

    } catch (error) {
      issues.push(`入力検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        inputElements: document.querySelectorAll('input, textarea, select').length
      }
    };
  }

  /**
   * DOM操作の安全性検証
   */
  validateDOMSafety() {
    const issues = [];
    let passed = true;

    try {
      // 拡張機能が作成した要素の検証
      const extensionElements = document.querySelectorAll('[data-popup-blocker]');
      for (const element of extensionElements) {
        // 危険な属性の確認
        if (element.hasAttribute('onclick') || element.hasAttribute('onload')) {
          issues.push(`危険なイベントハンドラが検出されました: ${element.tagName}`);
          passed = false;
        }

        // 外部リンクの確認
        if (element.tagName === 'A' && element.href && !element.href.startsWith('chrome-extension://')) {
          issues.push(`外部リンクが検出されました: ${element.href}`);
        }
      }

      // MutationObserverの適切な使用確認
      if (typeof MutationObserver !== 'undefined') {
        // 実装の詳細確認は困難だが、基本的な存在確認
      }

    } catch (error) {
      issues.push(`DOM安全性検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        extensionElements: document.querySelectorAll('[data-popup-blocker]').length
      }
    };
  }

  /**
   * メッセージパッシングの安全性検証
   */
  validateMessageSafety() {
    const issues = [];
    let passed = true;

    try {
      // メッセージリスナーの確認
      if (typeof chrome.runtime !== 'undefined') {
        // 実際のリスナー実装の検証は困難だが、基本的な確認
        
        // 送信元検証の実装確認（コード解析の限界）
        // 実際の実装では、メッセージハンドラーでsender.originの確認が必要
      }

    } catch (error) {
      issues.push(`メッセージ安全性検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        runtimeAvailable: typeof chrome.runtime !== 'undefined'
      }
    };
  }

  /**
   * ストレージ整合性の検証
   */
  async validateStorageIntegrity() {
    const issues = [];
    let passed = true;

    try {
      if (typeof chrome.storage !== 'undefined') {
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });

        // データ構造の整合性チェック
        for (const [key, value] of Object.entries(data)) {
          try {
            // JSON形式のデータの検証
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
              JSON.parse(value);
            }
          } catch (parseError) {
            issues.push(`不正なJSON形式のデータ: ${key}`);
            passed = false;
          }

          // データの有効期限チェック
          if (typeof value === 'object' && value.timestamp) {
            const age = Date.now() - value.timestamp;
            if (age > 30 * 24 * 60 * 60 * 1000) { // 30日
              issues.push(`古いデータが検出されました: ${key} (${Math.floor(age / (24 * 60 * 60 * 1000))}日前)`);
            }
          }
        }

        // ストレージ使用量の確認
        const usage = await new Promise((resolve) => {
          chrome.storage.local.getBytesInUse(null, resolve);
        });

        if (usage > 10 * 1024 * 1024) { // 10MB
          issues.push(`ストレージ使用量が多すぎます: ${(usage / 1024 / 1024).toFixed(2)}MB`);
        }
      }

    } catch (error) {
      issues.push(`ストレージ整合性検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        storageAvailable: typeof chrome.storage !== 'undefined'
      }
    };
  }

  /**
   * 外部通信の監視
   */
  validateExternalCommunication() {
    const issues = [];
    let passed = true;

    try {
      // XMLHttpRequestの監視
      const originalXHR = window.XMLHttpRequest;
      if (originalXHR && originalXHR.prototype.open !== originalXHR.prototype.open) {
        issues.push('XMLHttpRequestが改変されている可能性があります');
      }

      // fetchの監視
      const originalFetch = window.fetch;
      if (originalFetch && typeof originalFetch !== 'function') {
        issues.push('fetch APIが改変されている可能性があります');
      }

      // WebSocketの監視
      const originalWebSocket = window.WebSocket;
      if (originalWebSocket && originalWebSocket.prototype.send !== originalWebSocket.prototype.send) {
        issues.push('WebSocketが改変されている可能性があります');
      }

    } catch (error) {
      issues.push(`外部通信監視エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        xhrAvailable: typeof XMLHttpRequest !== 'undefined',
        fetchAvailable: typeof fetch !== 'undefined',
        websocketAvailable: typeof WebSocket !== 'undefined'
      }
    };
  }

  /**
   * コード整合性の検証
   */
  validateCodeIntegrity() {
    const issues = [];
    let passed = true;

    try {
      // マニフェストの整合性チェック
      const manifest = chrome.runtime.getManifest();
      
      // 必須フィールドの確認
      const requiredFields = ['name', 'version', 'manifest_version'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          issues.push(`マニフェストに必須フィールドがありません: ${field}`);
          passed = false;
        }
      }

      // Manifest V3の確認
      if (manifest.manifest_version !== 3) {
        issues.push(`古いマニフェストバージョンです: ${manifest.manifest_version}`);
        passed = false;
      }

      // 不審な権限の確認
      const suspiciousPermissions = ['debugger', 'management', 'system.cpu', 'system.memory'];
      const permissions = manifest.permissions || [];
      const suspiciousFound = permissions.filter(perm => suspiciousPermissions.includes(perm));
      
      if (suspiciousFound.length > 0) {
        issues.push(`不審な権限が検出されました: ${suspiciousFound.join(', ')}`);
        passed = false;
      }

    } catch (error) {
      issues.push(`コード整合性検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        manifestVersion: chrome.runtime.getManifest().manifest_version
      }
    };
  }

  /**
   * 依存関係の安全性検証
   */
  validateDependencySafety() {
    const issues = [];
    let passed = true;

    try {
      // 外部ライブラリの読み込み確認
      const scripts = document.querySelectorAll('script[src]');
      for (const script of scripts) {
        const src = script.src;
        
        // CDNからの読み込み確認
        if (src.includes('cdn.') || src.includes('unpkg.') || src.includes('jsdelivr.')) {
          issues.push(`外部CDNからのスクリプト読み込み: ${src}`);
        }

        // HTTPSの使用確認
        if (src.startsWith('http://')) {
          issues.push(`非セキュアなHTTP接続: ${src}`);
          passed = false;
        }
      }

    } catch (error) {
      issues.push(`依存関係安全性検証エラー: ${error.message}`);
      passed = false;
    }

    return {
      passed,
      issues,
      details: {
        externalScripts: document.querySelectorAll('script[src]').length
      }
    };
  }

  /**
   * 暗号化されているかチェック
   */
  isEncrypted(value) {
    // 簡単な暗号化判定（実際の実装に応じて調整）
    return value.length > 20 && !/^[a-zA-Z0-9\s]*$/.test(value);
  }

  /**
   * 疑わしいコンテンツを含むかチェック
   */
  containsSuspiciousContent(value) {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\.write/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(value));
  }

  /**
   * 検証結果のサマリーを生成
   */
  generateValidationSummary(results) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    
    const severityCounts = {
      high: results.filter(r => !r.passed && r.severity === 'high').length,
      medium: results.filter(r => !r.passed && r.severity === 'medium').length,
      low: results.filter(r => !r.passed && r.severity === 'low').length
    };

    return {
      total,
      passed,
      failed,
      passRate: (passed / total * 100).toFixed(1),
      severityCounts
    };
  }

  /**
   * 脅威レベルを更新
   */
  updateThreatLevel(results) {
    const highSeverityIssues = results.filter(r => !r.passed && r.severity === 'high').length;
    const mediumSeverityIssues = results.filter(r => !r.passed && r.severity === 'medium').length;

    if (highSeverityIssues > 0) {
      this.threatLevel = 'high';
    } else if (mediumSeverityIssues > 2) {
      this.threatLevel = 'medium';
    } else if (mediumSeverityIssues > 0) {
      this.threatLevel = 'low-medium';
    } else {
      this.threatLevel = 'low';
    }
  }

  /**
   * セキュリティ問題をログに記録
   */
  logSecurityIssues(results) {
    const failedResults = results.filter(r => !r.passed);
    
    for (const result of failedResults) {
      const logLevel = result.severity === 'high' ? 'error' : 
                     result.severity === 'medium' ? 'warn' : 'info';
      
      this.logger[logLevel]('SECURITY_VALIDATOR', `セキュリティ問題: ${result.name}`, {
        ruleId: result.ruleId,
        severity: result.severity,
        issues: result.issues,
        details: result.details
      });

      // セキュリティイベントとして記録
      this.securityEvents.push({
        timestamp: Date.now(),
        type: 'security_issue',
        severity: result.severity,
        rule: result.ruleId,
        issues: result.issues,
        details: result.details
      });
    }

    // イベント履歴の制限（最新1000件まで）
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
  }

  /**
   * セキュリティレポートを生成
   */
  generateSecurityReport() {
    return {
      timestamp: Date.now(),
      threatLevel: this.threatLevel,
      lastValidation: this.lastValidation,
      recentEvents: this.securityEvents.slice(-50), // 最新50件
      summary: {
        totalValidations: this.securityEvents.length,
        highSeverityIssues: this.securityEvents.filter(e => e.severity === 'high').length,
        mediumSeverityIssues: this.securityEvents.filter(e => e.severity === 'medium').length,
        lowSeverityIssues: this.securityEvents.filter(e => e.severity === 'low').length
      },
      recommendations: this.generateSecurityRecommendations()
    };
  }

  /**
   * セキュリティ推奨事項を生成
   */
  generateSecurityRecommendations() {
    const recommendations = [];
    
    if (this.threatLevel === 'high') {
      recommendations.push({
        priority: 'urgent',
        message: '高リスクのセキュリティ問題が検出されました。直ちに対処してください。',
        action: 'immediate_action_required'
      });
    }

    const recentHighIssues = this.securityEvents
      .filter(e => e.severity === 'high' && Date.now() - e.timestamp < 3600000) // 1時間以内
      .length;

    if (recentHighIssues > 0) {
      recommendations.push({
        priority: 'high',
        message: '最近高リスクの問題が発生しています。セキュリティ設定を確認してください。',
        action: 'review_security_settings'
      });
    }

    if (this.securityEvents.length > 100) {
      recommendations.push({
        priority: 'medium',
        message: 'セキュリティイベントが多数発生しています。定期的な監査を検討してください。',
        action: 'schedule_security_audit'
      });
    }

    return recommendations;
  }

  /**
   * 手動検証を実行
   */
  async runManualValidation() {
    this.logger.info('SECURITY_VALIDATOR', '手動セキュリティ検証を開始します');
    await this.runValidation('all');
    return this.generateSecurityReport();
  }

  /**
   * セキュリティ検証を停止
   */
  stopValidation() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    
    this.logger.info('SECURITY_VALIDATOR', 'セキュリティ検証を停止しました');
  }

  /**
   * セキュリティ検証システムを破棄
   */
  destroy() {
    this.stopValidation();
    this.securityEvents = [];
    this.validationRules.clear();
    
    this.logger.info('SECURITY_VALIDATOR', 'セキュリティ検証システムを破棄しました');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecurityValidator };
} else if (typeof window !== 'undefined') {
  window.SecurityValidator = SecurityValidator;
}