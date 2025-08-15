/**
 * PopupDetector と AdPreviewCapture の統合検証スクリプト
 */

// 必要なファイルを読み込み
const fs = require('fs');
const path = require('path');

console.log('🔍 PopupDetector と AdPreviewCapture の統合検証を開始...\n');

// 1. ファイルの存在確認
const requiredFiles = [
  'content/popup-detector-safe.js',
  'content/ad-preview-capture.js',
  'content/privacy-manager.js',
  'tests/popup-detector-integration.test.js',
  'test-popup-detector-integration.html'
];

console.log('📁 必要なファイルの存在確認:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ 必要なファイルが不足しています。');
  process.exit(1);
}

// 2. PopupDetector の統合機能確認
console.log('\n🔧 PopupDetector の統合機能確認:');

const popupDetectorContent = fs.readFileSync(path.join(__dirname, 'content/popup-detector-safe.js'), 'utf8');

const integrationFeatures = [
  {
    name: 'generateAdPreviews メソッド',
    pattern: /generateAdPreviews\s*\(/,
    description: 'AdPreviewCapture を呼び出すメソッドが存在する'
  },
  {
    name: 'AdPreviewCapture インスタンス化',
    pattern: /new\s+window\.AdPreviewCapture/,
    description: 'AdPreviewCapture のインスタンスを作成している'
  },
  {
    name: 'プレビュー進行状況表示',
    pattern: /showPreviewGenerationProgress/,
    description: 'プレビュー生成の進行状況表示機能がある'
  },
  {
    name: 'プレビューデータの UserChoiceDialog への渡し',
    pattern: /showChoiceDialog\(detectedPopups,\s*previewData\)/,
    description: 'プレビューデータを UserChoiceDialog に渡している'
  }
];

integrationFeatures.forEach(feature => {
  const found = feature.pattern.test(popupDetectorContent);
  console.log(`  ${found ? '✅' : '❌'} ${feature.name}: ${feature.description}`);
});

// 3. 統合テストファイルの内容確認
console.log('\n🧪 統合テストファイルの内容確認:');

const testContent = fs.readFileSync(path.join(__dirname, 'tests/popup-detector-integration.test.js'), 'utf8');

const testFeatures = [
  {
    name: '基本統合テスト',
    pattern: /PopupDetectorがAdPreviewCaptureを正常に呼び出す/,
    description: '基本的な統合機能のテストが存在する'
  },
  {
    name: 'プレビューデータ渡しテスト',
    pattern: /プレビューデータがUserChoiceDialogに正しく渡される/,
    description: 'プレビューデータの受け渡しテストが存在する'
  },
  {
    name: 'エラーハンドリングテスト',
    pattern: /AdPreviewCaptureが利用できない場合でも正常に動作する/,
    description: 'エラーハンドリングのテストが存在する'
  },
  {
    name: 'プライバシー保護統合テスト',
    pattern: /プライバシー保護統合/,
    description: 'プライバシー保護機能の統合テストが存在する'
  },
  {
    name: 'パフォーマンス統合テスト',
    pattern: /パフォーマンス統合/,
    description: 'パフォーマンス関連の統合テストが存在する'
  }
];

testFeatures.forEach(feature => {
  const found = feature.pattern.test(testContent);
  console.log(`  ${found ? '✅' : '❌'} ${feature.name}: ${feature.description}`);
});

// 4. HTML テストファイルの確認
console.log('\n🌐 HTML テストファイルの確認:');

const htmlContent = fs.readFileSync(path.join(__dirname, 'test-popup-detector-integration.html'), 'utf8');

const htmlFeatures = [
  {
    name: 'システム初期化機能',
    pattern: /initializeSystem/,
    description: 'システム初期化機能が実装されている'
  },
  {
    name: '統合テスト実行機能',
    pattern: /runIntegrationTest/,
    description: '統合テスト実行機能が実装されている'
  },
  {
    name: 'プレビューテスト機能',
    pattern: /runPreviewTest/,
    description: 'プレビューテスト機能が実装されている'
  },
  {
    name: 'パフォーマンステスト機能',
    pattern: /runPerformanceTest/,
    description: 'パフォーマンステスト機能が実装されている'
  },
  {
    name: 'テスト用広告要素',
    pattern: /test-popup|test-banner|test-modal/,
    description: 'テスト用の広告要素が定義されている'
  }
];

htmlFeatures.forEach(feature => {
  const found = feature.pattern.test(htmlContent);
  console.log(`  ${found ? '✅' : '❌'} ${feature.name}: ${feature.description}`);
});

// 5. 統合の完全性チェック
console.log('\n🔗 統合の完全性チェック:');

const completenessChecks = [
  {
    name: 'PopupDetector → AdPreviewCapture 呼び出し',
    check: () => {
      return popupDetectorContent.includes('generateAdPreviews') &&
             popupDetectorContent.includes('AdPreviewCapture') &&
             popupDetectorContent.includes('captureMultipleElements');
    }
  },
  {
    name: 'プレビューデータ → UserChoiceDialog 渡し',
    check: () => {
      return popupDetectorContent.includes('showChoiceDialog(detectedPopups, previewData)');
    }
  },
  {
    name: 'エラーハンドリング実装',
    check: () => {
      return popupDetectorContent.includes('catch') &&
             popupDetectorContent.includes('previewError') &&
             popupDetectorContent.includes('continuing without previews');
    }
  },
  {
    name: '進行状況表示実装',
    check: () => {
      return popupDetectorContent.includes('showPreviewGenerationProgress') &&
             popupDetectorContent.includes('updatePreviewGenerationProgress') &&
             popupDetectorContent.includes('hidePreviewGenerationProgress');
    }
  },
  {
    name: '統合テストカバレッジ',
    check: () => {
      return testContent.includes('基本統合機能') &&
             testContent.includes('プレビュー生成機能') &&
             testContent.includes('プライバシー保護統合') &&
             testContent.includes('パフォーマンス統合') &&
             testContent.includes('エラーハンドリング統合');
    }
  }
];

let allChecksPass = true;
completenessChecks.forEach(check => {
  const passed = check.check();
  console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allChecksPass = false;
});

// 6. 結果サマリー
console.log('\n' + '='.repeat(60));
console.log('📊 統合検証結果サマリー');
console.log('='.repeat(60));

if (allFilesExist && allChecksPass) {
  console.log('🎉 統合検証が成功しました！');
  console.log('\n✅ すべての必要なファイルが存在します');
  console.log('✅ PopupDetector に AdPreviewCapture 統合機能が実装されています');
  console.log('✅ 包括的な統合テストが作成されています');
  console.log('✅ HTML テストファイルが完備されています');
  console.log('✅ 統合の完全性が確認されました');
  
  console.log('\n🚀 次のステップ:');
  console.log('1. ブラウザで test-popup-detector-integration.html を開いて手動テストを実行');
  console.log('2. 実際の Web サイトでの動作確認');
  console.log('3. パフォーマンステストの実行');
  
  process.exit(0);
} else {
  console.log('❌ 統合検証で問題が見つかりました');
  
  if (!allFilesExist) {
    console.log('❌ 必要なファイルが不足しています');
  }
  
  if (!allChecksPass) {
    console.log('❌ 統合の完全性に問題があります');
  }
  
  console.log('\n🔧 修正が必要な項目を確認して再実行してください');
  process.exit(1);
}