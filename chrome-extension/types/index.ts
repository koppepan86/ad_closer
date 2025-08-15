/**
 * TypeScript型定義
 * ポップアップ広告ブロッカー拡張機能
 */

// ポップアップデータの型定義
export interface PopupData {
  id: string;
  url: string;
  domain: string;
  timestamp: number;
  characteristics: PopupCharacteristics;
  userDecision: 'close' | 'keep' | 'pending';
  confidence: number;
  decisionTimestamp?: number;
}

// ポップアップ特性の型定義
export interface PopupCharacteristics {
  hasCloseButton: boolean;
  containsAds: boolean;
  hasExternalLinks: boolean;
  isModal: boolean;
  zIndex: number;
  dimensions: {
    width: number;
    height: number;
  };
  position?: {
    top: number;
    left: number;
  };
  opacity?: number;
  backgroundColor?: string;
}

// ユーザー設定の型定義
export interface UserPreferences {
  extensionEnabled: boolean;
  showNotifications: boolean;
  notificationDuration: number;
  whitelistedDomains: string[];
  learningEnabled: boolean;
  aggressiveMode: boolean;
  statistics: Statistics;
}

// 統計データの型定義
export interface Statistics {
  totalPopupsDetected: number;
  totalPopupsClosed: number;
  totalPopupsKept: number;
  lastResetDate: number;
}

// 学習パターンの型定義
export interface LearningPattern {
  patternId: string;
  characteristics: Partial<PopupCharacteristics>;
  userDecision: 'close' | 'keep';
  confidence: number;
  occurrences: number;
  lastSeen: number;
}

// メッセージタイプの型定義
export type MessageType = 
  | 'POPUP_DETECTED'
  | 'GET_USER_PREFERENCES'
  | 'UPDATE_USER_PREFERENCES'
  | 'GET_STATISTICS'
  | 'USER_DECISION'
  | 'GET_EXTENSION_STATE'
  | 'USER_DECISION_RESULT';

// メッセージの型定義
export interface Message {
  type: MessageType;
  data?: any;
}

// 拡張機能状態の型定義
export interface ExtensionState {
  enabled: boolean;
  activeTabId: number | null;
  pendingDecisions: Map<string, PendingDecision>;
}

// 決定待ちデータの型定義
export interface PendingDecision {
  tabId: number;
  popupData: PopupData;
}

// ストレージキーの型定義
export interface StorageData {
  userPreferences: UserPreferences;
  learningPatterns: LearningPattern[];
  popupHistory: PopupData[];
}