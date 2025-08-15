// Chrome ポップアップ広告ブロッカー拡張機能のコアデータモデル

/**
 * 検出されたポップアップ要素に関するデータを表現
 */
export interface PopupData {
  id: string;                    // 一意のポップアップ識別子
  url: string;                   // ポップアップが表示されたページURL
  domain: string;                // ページのドメイン
  timestamp: number;             // 検出タイムスタンプ
  characteristics: {             // ポップアップ分析データ
    hasCloseButton: boolean;     // 閉じるボタンの有無
    containsAds: boolean;        // 広告コンテンツの有無
    hasExternalLinks: boolean;   // 外部リンクの有無
    isModal: boolean;            // モーダルかどうか
    zIndex: number;              // z-index値
    dimensions: {                // 寸法
      width: number;             // 幅
      height: number;            // 高さ
    };
  };
  userDecision: 'close' | 'keep' | 'pending';  // ユーザーの決定
  confidence: number;            // 分析信頼度 (0-1)
}

/**
 * ユーザー設定と拡張機能設定
 */
export interface UserPreferences {
  extensionEnabled: boolean;     // 拡張機能有効/無効
  showNotifications: boolean;    // 通知表示の有無
  notificationDuration: number;  // 通知表示時間（ミリ秒）
  whitelistedDomains: string[];  // ホワイトリストドメイン
  learningEnabled: boolean;      // 学習機能有効/無効
  aggressiveMode: boolean;       // アグレッシブモード
  statistics: {                  // 統計情報
    totalPopupsDetected: number; // 検出されたポップアップ総数
    totalPopupsClosed: number;   // 閉じられたポップアップ総数
    totalPopupsKept: number;     // 保持されたポップアップ総数
    lastResetDate: number;       // 最終リセット日時（タイムスタンプ）
  };
}

/**
 * ポップアップ認識のための学習パターン
 */
export interface LearningPattern {
  patternId: string;             // パターン識別子
  characteristics: {             // マッチするポップアップ特性
    hasCloseButton?: boolean;    // 閉じるボタンの有無
    containsAds?: boolean;       // 広告コンテンツの有無
    hasExternalLinks?: boolean;  // 外部リンクの有無
    isModal?: boolean;           // モーダルかどうか
    zIndexRange?: {              // z-index範囲
      min: number;               // 最小値
      max: number;               // 最大値
    };
    dimensionRange?: {           // 寸法範囲
      width: { min: number; max: number; };   // 幅の範囲
      height: { min: number; max: number; };  // 高さの範囲
    };
  };
  userDecision: 'close' | 'keep'; // 過去のユーザー決定
  confidence: number;            // パターンの信頼性 (0-1)
  occurrences: number;           // このパターンが現れた回数
  lastSeen: number;             // 最後に見られたタイムスタンプ
}

/**
 * コンポーネント間通信のためのメッセージタイプ
 */
export interface ExtensionMessage {
  type: 'POPUP_DETECTED' | 'USER_DECISION' | 'GET_PREFERENCES' | 'UPDATE_PREFERENCES' | 'GET_STATISTICS';
  data?: any;                    // メッセージデータ
  tabId?: number;                // タブID
}

/**
 * デフォルトユーザー設定
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  extensionEnabled: true,        // 拡張機能を有効にする
  showNotifications: true,       // 通知を表示する
  notificationDuration: 5000,    // 通知表示時間（5秒）
  whitelistedDomains: [],        // ホワイトリストドメイン（空）
  learningEnabled: true,         // 学習機能を有効にする
  aggressiveMode: false,         // アグレッシブモードは無効
  statistics: {                  // 統計情報の初期値
    totalPopupsDetected: 0,      // 検出数：0
    totalPopupsClosed: 0,        // 閉鎖数：0
    totalPopupsKept: 0,          // 保持数：0
    lastResetDate: Date.now()    // リセット日時：現在時刻
  }
};