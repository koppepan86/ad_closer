// Type definitions for popup data structures
// ポップアップデータ構造の型定義

/**
 * ポップアップデータの型定義
 * @typedef {Object} PopupData
 * @property {string} id - 一意のポップアップ識別子
 * @property {string} url - ポップアップが表示されたページURL
 * @property {string} domain - ページのドメイン
 * @property {number} timestamp - 検出タイムスタンプ
 * @property {PopupCharacteristics} characteristics - ポップアップ分析データ
 * @property {string} userDecision - ユーザーの決定 ('close', 'keep', 'pending')
 * @property {number} confidence - 分析信頼度 (0-1)
 */

/**
 * ポップアップ特性の型定義
 * @typedef {Object} PopupCharacteristics
 * @property {boolean} hasCloseButton - 閉じるボタンがあるか
 * @property {boolean} containsAds - 広告コンテンツが含まれているか
 * @property {boolean} hasExternalLinks - 外部リンクが含まれているか
 * @property {boolean} isModal - モーダルダイアログか
 * @property {number} zIndex - z-indexの値
 * @property {PopupDimensions} dimensions - ポップアップの寸法
 */

/**
 * ポップアップ寸法の型定義
 * @typedef {Object} PopupDimensions
 * @property {number} width - 幅
 * @property {number} height - 高さ
 */

/**
 * メッセージタイプの定義
 */
const MESSAGE_TYPES = {
    POPUP_DETECTED: 'POPUP_DETECTED',
    GET_EXTENSION_STATUS: 'GET_EXTENSION_STATUS',
    EXTENSION_STATUS_CHANGED: 'EXTENSION_STATUS_CHANGED',
    CLOSE_POPUP: 'CLOSE_POPUP',
    USER_DECISION: 'USER_DECISION'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MESSAGE_TYPES };
}