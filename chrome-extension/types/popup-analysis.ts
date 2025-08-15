// TypeScript interfaces for popup analysis data structures
// ポップアップ分析データ構造のTypeScriptインターフェース

/**
 * ポップアップの位置特性
 */
export interface PopupPositionCharacteristics {
    type: string;
    isFixed: boolean;
    isAbsolute: boolean;
    isSticky: boolean;
}

/**
 * z-index特性
 */
export interface ZIndexCharacteristics {
    value: number;
    isHigh: boolean;
    isVeryHigh: boolean;
}

/**
 * 寸法特性
 */
export interface DimensionCharacteristics {
    width: number;
    height: number;
    area: number;
    aspectRatio: number;
    coversLargeArea: boolean;
    isFullScreen: boolean;
}

/**
 * モーダルオーバーレイ特性
 */
export interface ModalOverlayCharacteristics {
    hasOverlayBackground: boolean;
    blocksInteraction: boolean;
    hasBackdrop: boolean;
    centerPositioned: boolean;
}

/**
 * 閉じるボタン特性
 */
export interface CloseButtonCharacteristics {
    hasCloseButton: boolean;
    closeButtonTypes: string[];
    closeButtonPosition: string;
}

/**
 * コンテンツ特性
 */
export interface ContentCharacteristics {
    containsAds: boolean;
    hasExternalLinks: boolean;
    hasFormElements: boolean;
    hasMediaContent: boolean;
    textLength: number;
    hasCallToAction: boolean;
}

/**
 * 視覚的特性
 */
export interface VisualCharacteristics {
    backgroundColor: string;
    hasBoxShadow: boolean;
    hasBorder: boolean;
    opacity: number;
    isVisible: boolean;
}

/**
 * インタラクション特性
 */
export interface InteractionCharacteristics {
    hasClickHandlers: boolean;
    hasKeyboardHandlers: boolean;
    preventsBubbling: boolean;
}

/**
 * ポップアップの包括的な特性分析結果
 */
export interface PopupCharacteristics {
    position: PopupPositionCharacteristics;
    zIndex: ZIndexCharacteristics;
    dimensions: DimensionCharacteristics;
    modalOverlay: ModalOverlayCharacteristics;
    closeButton: CloseButtonCharacteristics;
    content: ContentCharacteristics;
    visual: VisualCharacteristics;
    interaction: InteractionCharacteristics;
}

/**
 * ポップアップ分析の完全な結果
 */
export interface PopupAnalysisResult {
    id: string;
    url: string;
    domain: string;
    timestamp: number;
    characteristics: PopupCharacteristics;
    userDecision: 'pending' | 'close' | 'keep';
    confidence: number;
}

/**
 * 信頼度計算の重み設定
 */
export interface ConfidenceWeights {
    position: number;
    zIndex: number;
    dimensions: number;
    modalOverlay: number;
    content: number;
    closeButton: number;
    visual: number;
}

/**
 * ポップアップ分析設定
 */
export interface PopupAnalysisConfig {
    confidenceWeights: ConfidenceWeights;
    minimumConfidenceThreshold: number;
    enableDetailedLogging: boolean;
    analysisTimeout: number;
}