/**
 * 画像処理機能のユニットテスト
 */

// テスト用のモックcanvas作成
function createMockCanvas(width = 400, height = 300) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    
    // テスト用のグラデーション描画
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(1, '#4ecdc4');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // テキスト追加
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Test Ad', width / 2, height / 2);
    
    return canvas;
}

// テスト用のHTML要素作成
function createTestElement() {
    const element = document.createElement('div');
    element.style.width = '400px';
    element.style.height = '300px';
    element.style.background = 'linear-gradient(45deg, #ff6b6b, #4ecdc4)';
    element.style.color = 'white';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.fontSize = '24px';
    element.style.fontWeight = 'bold';
    element.textContent = 'Test Ad Element';
    
    document.body.appendChild(element);
    return element;
}

// テスト実行
async function runImageProcessingTests() {
    console.log('=== 画像処理機能テスト開始 ===');
    
    try {
        // AdPreviewCapture初期化
        const capture = new AdPreviewCapture({
            debugMode: true,
            imageQuality: 0.8,
            thumbnailWidth: 300,
            thumbnailHeight: 200,
            fullSizeWidth: 800,
            fullSizeHeight: 600
        });
        
        await capture.waitForInit();
        console.log('✓ AdPreviewCapture初期化完了');
        
        // テスト1: WebP対応チェック
        console.log('\n--- テスト1: WebP対応チェック ---');
        console.log(`WebP対応: ${capture.webpSupported}`);
        console.log(`WebP品質制御対応: ${capture.webpQualitySupport}`);
        
        // テスト2: 画像複雑度分析
        console.log('\n--- テスト2: 画像複雑度分析 ---');
        const testCanvas = createMockCanvas(400, 300);
        const complexity = capture.analyzeImageComplexity(testCanvas);
        console.log('複雑度分析結果:', complexity);
        console.log(`✓ 複雑度スコア: ${complexity.complexity.toFixed(3)}`);
        
        // テスト3: 適応的品質調整
        console.log('\n--- テスト3: 適応的品質調整 ---');
        const thumbnailQuality = capture.getAdaptiveQuality(testCanvas, 'webp', 'thumbnail');
        const fullSizeQuality = capture.getAdaptiveQuality(testCanvas, 'webp', 'fullSize');
        console.log(`サムネイル品質: ${thumbnailQuality.toFixed(3)}`);
        console.log(`拡大画像品質: ${fullSizeQuality.toFixed(3)}`);
        
        // テスト4: サムネイル生成
        console.log('\n--- テスト4: サムネイル生成 ---');
        const thumbnailCanvas = capture.generateThumbnail(testCanvas);
        console.log(`✓ サムネイル生成: ${thumbnailCanvas.width}x${thumbnailCanvas.height}`);
        
        // テスト5: 拡大画像生成
        console.log('\n--- テスト5: 拡大画像生成 ---');
        const fullSizeCanvas = capture.generateFullSizeImage(testCanvas);
        console.log(`✓ 拡大画像生成: ${fullSizeCanvas.width}x${fullSizeCanvas.height}`);
        
        // テスト6: 画像処理統合テスト
        console.log('\n--- テスト6: 画像処理統合テスト ---');
        const startTime = Date.now();
        const processedImages = await capture.processImage(testCanvas);
        const processingTime = Date.now() - startTime;
        
        console.log('✓ 画像処理完了:', {
            processingTime: `${processingTime}ms`,
            thumbnailFormat: processedImages.thumbnailFormat,
            fullSizeFormat: processedImages.fullSizeFormat,
            thumbnailSize: processedImages.thumbnailSize,
            fullSizeSize: processedImages.fullSizeSize,
            compression: processedImages.compression
        });
        
        // テスト7: 実要素キャプチャテスト
        console.log('\n--- テスト7: 実要素キャプチャテスト ---');
        const testElement = createTestElement();
        
        const captureStartTime = Date.now();
        const captureResult = await capture.captureElement(testElement);
        const captureTime = Date.now() - captureStartTime;
        
        console.log('✓ 要素キャプチャ完了:', {
            captureTime: `${captureTime}ms`,
            elementInfo: captureResult.elementInfo,
            screenshot: {
                thumbnailFormat: captureResult.screenshot.thumbnailFormat,
                fullSizeFormat: captureResult.screenshot.fullSizeFormat,
                processingTime: captureResult.screenshot.processingTime
            }
        });
        
        // テスト8: 圧縮統計検証
        console.log('\n--- テスト8: 圧縮統計検証 ---');
        const stats = captureResult.screenshot.compression;
        console.log('圧縮統計:', {
            originalPixels: stats.originalPixels,
            thumbnailReduction: `${stats.thumbnailReduction}%`,
            fullSizeReduction: `${stats.fullSizeReduction}%`,
            thumbnailRatio: stats.thumbnailRatio,
            fullSizeRatio: stats.fullSizeRatio
        });
        
        // 検証
        if (stats.thumbnailReduction > 0) {
            console.log('✓ サムネイル圧縮が正常に動作');
        }
        
        if (captureResult.screenshot.thumbnailFormat === 'webp' || captureResult.screenshot.thumbnailFormat === 'png') {
            console.log('✓ 適切な画像フォーマットが選択されている');
        }
        
        // クリーンアップ
        document.body.removeChild(testElement);
        
        console.log('\n=== 全テスト完了 ===');
        return true;
        
    } catch (error) {
        console.error('テストエラー:', error);
        return false;
    }
}

// テスト結果表示用HTML生成
function generateTestReport(success) {
    return `
        <div style="padding: 20px; margin: 20px; border: 2px solid ${success ? 'green' : 'red'}; border-radius: 5px;">
            <h2>画像処理機能テスト結果</h2>
            <p><strong>結果:</strong> ${success ? '✓ 成功' : '✗ 失敗'}</p>
            <p><strong>実行時間:</strong> ${new Date().toLocaleString()}</p>
            <p>詳細はコンソールログを確認してください。</p>
        </div>
    `;
}

// グローバルに公開
if (typeof window !== 'undefined') {
    window.runImageProcessingTests = runImageProcessingTests;
    window.generateTestReport = generateTestReport;
}

console.log('画像処理テストモジュール読み込み完了');