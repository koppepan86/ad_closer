/**
 * 学習システム関数（テスト用分離モジュール）
 */

// デフォルトユーザー設定
const DEFAULT_PREFERENCES = {
    extensionEnabled: true,
    showNotifications: true,
    notificationDuration: 5000,
    whitelistedDomains: [],
    learningEnabled: true,
    aggressiveMode: false,
    statistics: {
        totalPopupsDetected: 0,
        totalPopupsClosed: 0,
        totalPopupsKept: 0,
        lastResetDate: Date.now()
    }
};

/**
 * ユーザー設定の取得
 */
async function getUserPreferences() {
    try {
        const result = await chrome.storage.local.get(['userPreferences']);
        return result.userPreferences || DEFAULT_PREFERENCES;
    } catch (error) {
        console.error('ユーザー設定取得エラー:', error);
        return DEFAULT_PREFERENCES;
    }
}

/**
 * 学習データの更新
 */
async function updateLearningData(popupRecord) {
    try {
        console.log('学習データ更新:', popupRecord.id, popupRecord.userDecision);

        // 学習が無効の場合はスキップ
        const preferences = await getUserPreferences();
        if (!preferences.learningEnabled) {
            console.log('学習機能が無効のためスキップ');
            return;
        }

        // 有効な決定のみ学習（timeout や dismiss は除外）
        if (!['close', 'keep'].includes(popupRecord.userDecision)) {
            console.log('無効な決定のため学習をスキップ:', popupRecord.userDecision);
            return;
        }

        // 既存の学習パターンを取得
        const result = await chrome.storage.local.get(['learningPatterns']);
        let patterns = result.learningPatterns || [];

        // 類似パターンを検索
        const matchingPattern = findMatchingPattern(patterns, popupRecord.characteristics);

        if (matchingPattern) {
            // 既存パターンを更新
            await updateExistingPattern(patterns, matchingPattern, popupRecord);
            console.log('既存パターンを更新:', matchingPattern.patternId);
        } else {
            // 新しいパターンを作成
            const newPattern = createNewPattern(popupRecord);
            patterns.push(newPattern);
            console.log('新しいパターンを作成:', newPattern.patternId);
        }

        // パターンリストをクリーンアップ（古いパターンや低信頼度パターンを削除）
        patterns = cleanupPatterns(patterns);

        // 更新されたパターンを保存
        await chrome.storage.local.set({ learningPatterns: patterns });

        console.log('学習データ更新完了。パターン数:', patterns.length);

    } catch (error) {
        console.error('学習データ更新エラー:', error);
    }
}

/**
 * 類似のポップアップ特性のパターンマッチングを実装
 */
function findMatchingPattern(patterns, characteristics) {
    const SIMILARITY_THRESHOLD = 0.7; // 70%以上の類似度で一致とみなす

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const pattern of patterns) {
        const similarity = calculateSimilarity(pattern.characteristics, characteristics);

        if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
            bestMatch = pattern;
            bestSimilarity = similarity;
        }
    }

    return bestMatch;
}

/**
 * ポップアップ特性の類似度を計算
 */
function calculateSimilarity(pattern, characteristics) {
    const weights = {
        hasCloseButton: 0.15,
        containsAds: 0.25,
        hasExternalLinks: 0.20,
        isModal: 0.15,
        zIndex: 0.10,
        dimensions: 0.15
    };

    let totalWeight = 0;
    let matchedWeight = 0;

    // ブール値の比較
    for (const key of ['hasCloseButton', 'containsAds', 'hasExternalLinks', 'isModal']) {
        if (pattern[key] !== undefined && characteristics[key] !== undefined) {
            totalWeight += weights[key];
            if (pattern[key] === characteristics[key]) {
                matchedWeight += weights[key];
            }
        }
    }

    // zIndexの比較（範囲で判定）
    if (pattern.zIndex !== undefined && characteristics.zIndex !== undefined) {
        totalWeight += weights.zIndex;
        const zIndexDiff = Math.abs(pattern.zIndex - characteristics.zIndex);
        if (zIndexDiff <= 100) { // 100以内なら類似とみなす
            matchedWeight += weights.zIndex * (1 - zIndexDiff / 1000);
        }
    }

    // 寸法の比較
    if (pattern.dimensions && characteristics.dimensions) {
        totalWeight += weights.dimensions;
        const widthSimilarity = calculateDimensionSimilarity(
            pattern.dimensions.width,
            characteristics.dimensions.width
        );
        const heightSimilarity = calculateDimensionSimilarity(
            pattern.dimensions.height,
            characteristics.dimensions.height
        );
        matchedWeight += weights.dimensions * (widthSimilarity + heightSimilarity) / 2;
    }

    return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/**
 * 寸法の類似度を計算
 */
function calculateDimensionSimilarity(value1, value2) {
    if (value1 === undefined || value2 === undefined) return 0;

    const diff = Math.abs(value1 - value2);
    const max = Math.max(value1, value2);

    if (max === 0) return 1;

    // 20%以内の差なら高い類似度
    const similarity = Math.max(0, 1 - diff / max);
    return similarity;
}

/**
 * 既存パターンを更新
 */
async function updateExistingPattern(patterns, matchingPattern, popupRecord) {
    const patternIndex = patterns.findIndex(p => p.patternId === matchingPattern.patternId);

    if (patternIndex >= 0) {
        const pattern = patterns[patternIndex];

        // 出現回数を増加
        pattern.occurrences++;
        pattern.lastSeen = Date.now();

        // 決定が一致する場合は信頼度を上げる
        if (pattern.userDecision === popupRecord.userDecision) {
            pattern.confidence = Math.min(1.0, pattern.confidence + 0.1);
        } else {
            // 決定が異なる場合は信頼度を下げる
            pattern.confidence = Math.max(0.1, pattern.confidence - 0.2);

            // 信頼度が低くなった場合、より頻繁な決定に更新
            if (pattern.confidence < 0.3) { // 閾値を下げる
                pattern.userDecision = popupRecord.userDecision;
                pattern.confidence = 0.6; // 新しい決定で再スタート
            }
        }

        // 特性を平均化して更新（より一般的なパターンにする）
        pattern.characteristics = averageCharacteristics(
            pattern.characteristics,
            popupRecord.characteristics,
            pattern.occurrences
        );

        console.log(`パターン更新: ${pattern.patternId}, 信頼度: ${pattern.confidence.toFixed(2)}, 出現回数: ${pattern.occurrences}`);
    }
}

/**
 * 特性を平均化
 */
function averageCharacteristics(existingChar, newChar, occurrences) {
    const result = { ...existingChar };

    // 数値の平均化
    if (typeof newChar.zIndex === 'number' && typeof existingChar.zIndex === 'number') {
        result.zIndex = Math.round((existingChar.zIndex * (occurrences - 1) + newChar.zIndex) / occurrences);
    }

    // 寸法の平均化
    if (newChar.dimensions && existingChar.dimensions) {
        result.dimensions = {
            width: Math.round((existingChar.dimensions.width * (occurrences - 1) + newChar.dimensions.width) / occurrences),
            height: Math.round((existingChar.dimensions.height * (occurrences - 1) + newChar.dimensions.height) / occurrences)
        };
    }

    // ブール値は多数決で決定
    for (const key of ['hasCloseButton', 'containsAds', 'hasExternalLinks', 'isModal']) {
        if (typeof newChar[key] === 'boolean') {
            // 新しい値が既存の値と異なる場合、出現回数に基づいて決定
            if (occurrences <= 2) {
                result[key] = newChar[key]; // 少ない場合は新しい値を採用
            }
            // 多い場合は既存の値を維持（多数決の概念）
        }
    }

    return result;
}

/**
 * 新しいパターンを作成
 */
function createNewPattern(popupRecord) {
    const patternId = generatePatternId();

    return {
        patternId: patternId,
        characteristics: { ...popupRecord.characteristics },
        userDecision: popupRecord.userDecision,
        confidence: 0.6, // 初期信頼度
        occurrences: 1,
        lastSeen: Date.now(),
        domain: popupRecord.domain // ドメイン情報も保存
    };
}

/**
 * パターンIDを生成
 */
function generatePatternId() {
    return 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * パターンリストをクリーンアップ
 */
function cleanupPatterns(patterns) {
    const now = Date.now();
    const OLD_PATTERN_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30日
    const LOW_CONFIDENCE_THRESHOLD = 0.3;
    const MAX_PATTERNS = 100; // 最大パターン数

    // 古いパターンや低信頼度パターンを除去
    let cleanedPatterns = patterns.filter(pattern => {
        const isRecent = (now - pattern.lastSeen) < OLD_PATTERN_THRESHOLD;
        const hasGoodConfidence = pattern.confidence >= LOW_CONFIDENCE_THRESHOLD;
        const hasMinOccurrences = pattern.occurrences >= 1; // 最小出現回数を1に変更

        return isRecent && hasGoodConfidence && hasMinOccurrences;
    });

    // 信頼度順にソートして上位のみ保持
    cleanedPatterns.sort((a, b) => {
        // 信頼度 × 出現回数 × 新しさ でスコア計算
        const scoreA = a.confidence * Math.log(a.occurrences + 1) * (1 - (now - a.lastSeen) / OLD_PATTERN_THRESHOLD);
        const scoreB = b.confidence * Math.log(b.occurrences + 1) * (1 - (now - b.lastSeen) / OLD_PATTERN_THRESHOLD);
        return scoreB - scoreA;
    });

    if (cleanedPatterns.length > MAX_PATTERNS) {
        cleanedPatterns = cleanedPatterns.slice(0, MAX_PATTERNS);
    }

    console.log(`パターンクリーンアップ: ${patterns.length} → ${cleanedPatterns.length}`);

    return cleanedPatterns;
}

/**
 * 将来のポップアップのパターンベース自動提案を追加
 */
async function getPatternBasedSuggestion(popupCharacteristics, domain) {
    try {
        const preferences = await getUserPreferences();
        if (!preferences.learningEnabled) {
            return null;
        }

        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns || [];

        if (patterns.length === 0) {
            return null;
        }

        // 最も類似度の高いパターンを検索
        let bestMatch = null;
        let bestSimilarity = 0;
        const MIN_CONFIDENCE_FOR_SUGGESTION = 0.7;
        const MIN_SIMILARITY_FOR_SUGGESTION = 0.8;

        for (const pattern of patterns) {
            // 信頼度が十分でない場合はスキップ
            if (pattern.confidence < MIN_CONFIDENCE_FOR_SUGGESTION) {
                continue;
            }

            const similarity = calculateSimilarity(pattern.characteristics, popupCharacteristics);

            if (similarity >= MIN_SIMILARITY_FOR_SUGGESTION && similarity > bestSimilarity) {
                bestMatch = pattern;
                bestSimilarity = similarity;
            }
        }

        if (bestMatch) {
            console.log(`パターンベース提案: ${bestMatch.userDecision} (信頼度: ${bestMatch.confidence.toFixed(2)}, 類似度: ${bestSimilarity.toFixed(2)})`);

            return {
                suggestion: bestMatch.userDecision,
                confidence: bestMatch.confidence,
                similarity: bestSimilarity,
                patternId: bestMatch.patternId,
                occurrences: bestMatch.occurrences
            };
        }

        return null;

    } catch (error) {
        console.error('パターンベース提案エラー:', error);
        return null;
    }
}

/**
 * 学習パターンの統計を取得
 */
async function getLearningStatistics() {
    try {
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns || [];

        const stats = {
            totalPatterns: patterns.length,
            highConfidencePatterns: patterns.filter(p => p.confidence >= 0.8).length,
            closePatterns: patterns.filter(p => p.userDecision === 'close').length,
            keepPatterns: patterns.filter(p => p.userDecision === 'keep').length,
            averageConfidence: patterns.length > 0 ?
                patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0,
            totalOccurrences: patterns.reduce((sum, p) => sum + p.occurrences, 0)
        };

        return stats;

    } catch (error) {
        console.error('学習統計取得エラー:', error);
        return null;
    }
}

module.exports = {
    updateLearningData,
    getPatternBasedSuggestion,
    getLearningStatistics,
    findMatchingPattern,
    calculateSimilarity,
    createNewPattern,
    cleanupPatterns,
    updateExistingPattern,
    averageCharacteristics,
    generatePatternId,
    calculateDimensionSimilarity
};