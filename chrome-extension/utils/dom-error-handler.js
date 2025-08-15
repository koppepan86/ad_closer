/**
 * DOM アクセス制限エラーハンドリング
 * Chrome拡張機能のコンテンツスクリプト用
 */

/**
 * DOM エラーハンドラークラス
 */
class DOMErrorHandler {
  constructor() {
    this.restrictedDomains = new Set();
    this.fallbackSelectors = new Map();
    this.safeOperations = new Map();
    this.accessAttempts = new Map();
    this.maxAccessAttempts = 3;
    
    this.initializeSafeOperations();
    this.setupFallbackSelectors();
  }

  /**
   * 安全な DOM 操作を初期化
   */
  initializeSafeOperations() {
    // 安全な querySelector
    this.safeOperations.set('querySelector', (selector, context = document) => {
      try {
        if (!context || typeof context.querySelector !== 'function') {
          throw new Error('Invalid context for querySelector');
        }
        return context.querySelector(selector);
      } catch (error) {
        console.warn(`querySelector failed for selector: ${selector}`, error);
        return null;
      }
    });

    // 安全な querySelectorAll
    this.safeOperations.set('querySelectorAll', (selector, context = document) => {
      try {
        if (!context || typeof context.querySelectorAll !== 'function') {
          throw new Error('Invalid context for querySelectorAll');
        }
        return Array.from(context.querySelectorAll(selector));
      } catch (error) {
        console.warn(`querySelectorAll failed for selector: ${selector}`, error);
        return [];
      }
    });

    // 安全な要素作成
    this.safeOperations.set('createElement', (tagName) => {
      try {
        if (!document || typeof document.createElement !== 'function') {
          throw new Error('Document not available');
        }
        return document.createElement(tagName);
      } catch (error) {
        console.warn(`createElement failed for tag: ${tagName}`, error);
        return null;
      }
    });

    // 安全な要素追加
    this.safeOperations.set('appendChild', (parent, child) => {
      try {
        if (!parent || !child || typeof parent.appendChild !== 'function') {
          throw new Error('Invalid parent or child for appendChild');
        }
        return parent.appendChild(child);
      } catch (error) {
        console.warn('appendChild failed', error);
        return null;
      }
    });

    // 安全な要素削除
    this.safeOperations.set('removeChild', (parent, child) => {
      try {
        if (!parent || !child || typeof parent.removeChild !== 'function') {
          throw new Error('Invalid parent or child for removeChild');
        }
        return parent.removeChild(child);
      } catch (error) {
        console.warn('removeChild failed', error);
        return null;
      }
    });

    // 安全な要素削除（新しい方法）
    this.safeOperations.set('remove', (element) => {
      try {
        if (!element) {
          throw new Error('Invalid element for remove');
        }
        
        if (typeof element.remove === 'function') {
          element.remove();
        } else if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
          element.parentNode.removeChild(element);
        } else {
          throw new Error('No removal method available');
        }
        return true;
      } catch (error) {
        console.warn('Element removal failed', error);
        return false;
      }
    });

    // 安全なスタイル設定
    this.safeOperations.set('setStyle', (element, property, value) => {
      try {
        if (!element || !element.style) {
          throw new Error('Invalid element for style setting');
        }
        element.style[property] = value;
        return true;
      } catch (error) {
        console.warn(`Style setting failed for ${property}: ${value}`, error);
        return false;
      }
    });

    // 安全な属性設定
    this.safeOperations.set('setAttribute', (element, name, value) => {
      try {
        if (!element || typeof element.setAttribute !== 'function') {
          throw new Error('Invalid element for setAttribute');
        }
        element.setAttribute(name, value);
        return true;
      } catch (error) {
        console.warn(`setAttribute failed for ${name}: ${value}`, error);
        return false;
      }
    });

    // 安全な属性取得
    this.safeOperations.set('getAttribute', (element, name) => {
      try {
        if (!element || typeof element.getAttribute !== 'function') {
          throw new Error('Invalid element for getAttribute');
        }
        return element.getAttribute(name);
      } catch (error) {
        console.warn(`getAttribute failed for ${name}`, error);
        return null;
      }
    });

    // 安全なイベントリスナー追加
    this.safeOperations.set('addEventListener', (element, event, handler, options) => {
      try {
        if (!element || typeof element.addEventListener !== 'function') {
          throw new Error('Invalid element for addEventListener');
        }
        element.addEventListener(event, handler, options);
        return true;
      } catch (error) {
        console.warn(`addEventListener failed for event: ${event}`, error);
        return false;
      }
    });

    // 安全なイベントリスナー削除
    this.safeOperations.set('removeEventListener', (element, event, handler, options) => {
      try {
        if (!element || typeof element.removeEventListener !== 'function') {
          throw new Error('Invalid element for removeEventListener');
        }
        element.removeEventListener(event, handler, options);
        return true;
      } catch (error) {
        console.warn(`removeEventListener failed for event: ${event}`, error);
        return false;
      }
    });
  }

  /**
   * フォールバックセレクターを設定
   */
  setupFallbackSelectors() {
    // ポップアップ検出用のフォールバックセレクター
    this.fallbackSelectors.set('popup', [
      '.popup',
      '.modal',
      '.overlay',
      '.dialog',
      '[role="dialog"]',
      '[role="alertdialog"]',
      '.lightbox',
      '.fancybox'
    ]);

    // 閉じるボタン用のフォールバックセレクター
    this.fallbackSelectors.set('closeButton', [
      '.close',
      '.close-button',
      '[aria-label*="close"]',
      '[aria-label*="閉じる"]',
      'button[title*="close"]',
      'button[title*="閉じる"]',
      '.modal-close',
      '.popup-close'
    ]);

    // オーバーレイ用のフォールバックセレクター
    this.fallbackSelectors.set('overlay', [
      '.overlay',
      '.modal-overlay',
      '.backdrop',
      '.modal-backdrop',
      '.popup-overlay'
    ]);
  }

  /**
   * 安全な DOM 操作を実行
   */
  safeExecute(operation, ...args) {
    const operationFunc = this.safeOperations.get(operation);
    if (!operationFunc) {
      console.error(`Unknown safe operation: ${operation}`);
      return null;
    }

    try {
      return operationFunc(...args);
    } catch (error) {
      console.error(`Safe operation ${operation} failed:`, error);
      
      // エラーハンドラーに報告
      if (typeof window !== 'undefined' && window.globalErrorHandler) {
        window.globalErrorHandler.handleError(
          error,
          window.ERROR_TYPES.DOM_ACCESS,
          window.ERROR_SEVERITY.MEDIUM,
          { operation, args: args.length }
        );
      }
      
      return null;
    }
  }

  /**
   * DOM アクセス制限を検出
   */
  detectDOMRestriction(domain = null) {
    try {
      // 基本的な DOM アクセステスト
      const testElement = document.createElement('div');
      document.body.appendChild(testElement);
      document.body.removeChild(testElement);
      
      return false; // 制限なし
    } catch (error) {
      console.warn('DOM access restriction detected:', error);
      
      if (domain) {
        this.restrictedDomains.add(domain);
      }
      
      return true; // 制限あり
    }
  }

  /**
   * 制限されたドメインかチェック
   */
  isRestrictedDomain(domain) {
    return this.restrictedDomains.has(domain);
  }

  /**
   * フォールバック要素検索
   */
  findElementWithFallback(selectorType, context = document) {
    const selectors = this.fallbackSelectors.get(selectorType) || [selectorType];
    
    for (const selector of selectors) {
      try {
        const element = this.safeExecute('querySelector', selector, context);
        if (element) {
          return element;
        }
      } catch (error) {
        console.debug(`Fallback selector failed: ${selector}`, error);
        continue;
      }
    }
    
    return null;
  }

  /**
   * フォールバック要素検索（複数）
   */
  findElementsWithFallback(selectorType, context = document) {
    const selectors = this.fallbackSelectors.get(selectorType) || [selectorType];
    const allElements = [];
    
    for (const selector of selectors) {
      try {
        const elements = this.safeExecute('querySelectorAll', selector, context);
        if (elements && elements.length > 0) {
          allElements.push(...elements);
        }
      } catch (error) {
        console.debug(`Fallback selector failed: ${selector}`, error);
        continue;
      }
    }
    
    // 重複を除去
    return [...new Set(allElements)];
  }

  /**
   * 安全な要素削除
   */
  safeRemoveElement(element) {
    if (!element) {
      return false;
    }

    try {
      // 要素が DOM に存在するかチェック
      if (!document.contains(element)) {
        console.debug('Element not in DOM, skipping removal');
        return true;
      }

      // 削除前にイベントリスナーをクリーンアップ
      this.cleanupElementListeners(element);

      // 安全な削除を実行
      const removed = this.safeExecute('remove', element);
      
      if (removed) {
        console.debug('Element removed successfully');
        return true;
      } else {
        console.warn('Element removal failed, trying alternative method');
        
        // 代替方法: 非表示にする
        const hidden = this.safeExecute('setStyle', element, 'display', 'none');
        if (hidden) {
          this.safeExecute('setStyle', element, 'visibility', 'hidden');
          this.safeExecute('setStyle', element, 'opacity', '0');
          console.debug('Element hidden as fallback');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Safe element removal failed:', error);
      
      // エラーハンドラーに報告
      if (typeof window !== 'undefined' && window.globalErrorHandler) {
        window.globalErrorHandler.handleError(
          error,
          window.ERROR_TYPES.DOM_ACCESS,
          window.ERROR_SEVERITY.MEDIUM,
          { operation: 'removeElement', elementTag: element.tagName }
        );
      }
      
      return false;
    }
  }

  /**
   * 要素のイベントリスナーをクリーンアップ
   */
  cleanupElementListeners(element) {
    try {
      // 一般的なイベントタイプをクリーンアップ
      const commonEvents = ['click', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keyup'];
      
      commonEvents.forEach(eventType => {
        try {
          // 新しいクローン要素を作成してイベントリスナーを削除
          const clone = element.cloneNode(true);
          if (element.parentNode) {
            element.parentNode.replaceChild(clone, element);
          }
        } catch (error) {
          console.debug(`Event cleanup failed for ${eventType}:`, error);
        }
      });
    } catch (error) {
      console.debug('Element listener cleanup failed:', error);
    }
  }

  /**
   * DOM 変更の安全な監視
   */
  createSafeMutationObserver(callback, options = {}) {
    try {
      if (!window.MutationObserver) {
        console.warn('MutationObserver not available');
        return null;
      }

      const safeCallback = (mutations, observer) => {
        try {
          callback(mutations, observer);
        } catch (error) {
          console.error('MutationObserver callback error:', error);
          
          // エラーハンドラーに報告
          if (typeof window !== 'undefined' && window.globalErrorHandler) {
            window.globalErrorHandler.handleError(
              error,
              window.ERROR_TYPES.DOM_ACCESS,
              window.ERROR_SEVERITY.LOW,
              { operation: 'mutationObserver' }
            );
          }
        }
      };

      const observer = new MutationObserver(safeCallback);
      
      // デフォルトオプション
      const defaultOptions = {
        childList: true,
        subtree: true,
        attributes: false,
        attributeOldValue: false,
        characterData: false,
        characterDataOldValue: false
      };

      const finalOptions = { ...defaultOptions, ...options };

      // 安全な監視開始
      try {
        observer.observe(document.body || document.documentElement, finalOptions);
        console.debug('MutationObserver started successfully');
        return observer;
      } catch (error) {
        console.error('MutationObserver.observe failed:', error);
        observer.disconnect();
        return null;
      }
    } catch (error) {
      console.error('MutationObserver creation failed:', error);
      return null;
    }
  }

  /**
   * DOM 準備状態の確認
   */
  waitForDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        const handler = () => {
          document.removeEventListener('DOMContentLoaded', handler);
          resolve();
        };
        document.addEventListener('DOMContentLoaded', handler);
      } else {
        resolve();
      }
    });
  }

  /**
   * 安全な要素の可視性チェック
   */
  isElementVisible(element) {
    try {
      if (!element) return false;

      // 基本的な可視性チェック
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || 
          style.visibility === 'hidden' || 
          parseFloat(style.opacity) === 0) {
        return false;
      }

      // 境界矩形チェック
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (error) {
      console.debug('Element visibility check failed:', error);
      return false;
    }
  }

  /**
   * 安全な要素の位置取得
   */
  getElementPosition(element) {
    try {
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
    } catch (error) {
      console.debug('Element position check failed:', error);
      return null;
    }
  }

  /**
   * DOM エラー統計を取得
   */
  getDOMErrorStatistics() {
    return {
      restrictedDomains: Array.from(this.restrictedDomains),
      accessAttempts: Object.fromEntries(this.accessAttempts),
      availableOperations: Array.from(this.safeOperations.keys()),
      fallbackSelectors: Object.fromEntries(this.fallbackSelectors)
    };
  }

  /**
   * DOM エラーハンドラーをリセット
   */
  reset() {
    this.restrictedDomains.clear();
    this.accessAttempts.clear();
  }
}

// グローバルインスタンスを作成
const domErrorHandler = new DOMErrorHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOMErrorHandler, domErrorHandler };
} else if (typeof window !== 'undefined') {
  window.DOMErrorHandler = DOMErrorHandler;
  window.domErrorHandler = domErrorHandler;
}