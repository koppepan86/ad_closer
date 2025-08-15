#!/usr/bin/env node

/**
 * UIコンポーネントテスト実行スクリプト
 * Task 9.1.5: UIコンポーネントのテスト - テスト実行管理
 * 
 * 分割されたUIテストファイルを効率的に実行するためのスクリプト
 */

const { execSync } = require('child_process');
const path = require('path');

// テストファイルの定義
const testFiles = [
  {
    name: 'ポップアップUI',
    file: 'popup-ui.test.js',
    description: 'ポップアップインターフェースのテスト'
  },
  {
    name: '設定ページUI',
    file: 'options-ui.test.js',
    description: '設定ページのインタラクションテスト'
  },
  {
    name: '通知システム',
    file: 'notification-ui.test.js',
    description: '通知システムのUIテスト'
  },
  {
    name: 'アクセシビリティ',
    file: 'accessibility.test.js',
    description: 'アクセシビリティ機能のテスト'
  }
];

/**
 * 個別のテストファイルを実行
 */
function runSingleTest(testFile) {
  console.log(`\n🧪 ${testFile.name}テストを実行中...`);
  console.log(`📝 ${testFile.description}`);
  console.log('─'.repeat(50));
  
  try {
    const command = `npx jest ${testFile.file} --verbose --no-cache`;
    const result = execSync(command, { 
      cwd: path.dirname(__filename),
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    console.log(`✅ ${testFile.name}テスト完了\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${testFile.name}テスト失敗:`);
    console.error(error.message);
    return false;
  }
}

/**
 * すべてのUIテストを実行
 */
function runAllTests() {
  console.log('🚀 UIコンポーネントテストスイートを開始');
  console.log('=' .repeat(60));
  
  const results = [];
  let totalPassed = 0;
  
  for (const testFile of testFiles) {
    const passed = runSingleTest(testFile);
    results.push({ name: testFile.name, passed });
    if (passed) totalPassed++;
  }
  
  // 結果サマリー
  console.log('\n📊 テスト結果サマリー');
  console.log('=' .repeat(60));
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  console.log('\n📈 統計:');
  console.log(`   合格: ${totalPassed}/${testFiles.length}`);
  console.log(`   成功率: ${Math.round((totalPassed / testFiles.length) * 100)}%`);
  
  if (totalPassed === testFiles.length) {
    console.log('\n🎉 すべてのUIテストが成功しました！');
    process.exit(0);
  } else {
    console.log('\n⚠️  一部のテストが失敗しました。');
    process.exit(1);
  }
}

/**
 * 特定のテストカテゴリのみを実行
 */
function runSpecificTest(testName) {
  const testFile = testFiles.find(t => 
    t.name.toLowerCase().includes(testName.toLowerCase()) ||
    t.file.toLowerCase().includes(testName.toLowerCase())
  );
  
  if (!testFile) {
    console.error(`❌ テスト "${testName}" が見つかりません。`);
    console.log('\n利用可能なテスト:');
    testFiles.forEach(t => console.log(`  - ${t.name} (${t.file})`));
    process.exit(1);
  }
  
  const passed = runSingleTest(testFile);
  process.exit(passed ? 0 : 1);
}

/**
 * ヘルプメッセージを表示
 */
function showHelp() {
  console.log('UIコンポーネントテスト実行スクリプト');
  console.log('\n使用方法:');
  console.log('  node run-ui-tests.js [オプション]');
  console.log('\nオプション:');
  console.log('  --all, -a          すべてのUIテストを実行');
  console.log('  --test <name>, -t  特定のテストのみを実行');
  console.log('  --list, -l         利用可能なテスト一覧を表示');
  console.log('  --help, -h         このヘルプを表示');
  console.log('\n例:');
  console.log('  node run-ui-tests.js --all');
  console.log('  node run-ui-tests.js --test popup');
  console.log('  node run-ui-tests.js --test accessibility');
}

/**
 * テスト一覧を表示
 */
function listTests() {
  console.log('📋 利用可能なUIテスト:');
  console.log('─'.repeat(50));
  
  testFiles.forEach((testFile, index) => {
    console.log(`${index + 1}. ${testFile.name}`);
    console.log(`   ファイル: ${testFile.file}`);
    console.log(`   説明: ${testFile.description}`);
    console.log('');
  });
}

// コマンドライン引数の処理
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--all') || args.includes('-a')) {
  runAllTests();
} else if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else if (args.includes('--list') || args.includes('-l')) {
  listTests();
} else if (args.includes('--test') || args.includes('-t')) {
  const testIndex = Math.max(args.indexOf('--test'), args.indexOf('-t'));
  const testName = args[testIndex + 1];
  
  if (!testName) {
    console.error('❌ テスト名を指定してください。');
    showHelp();
    process.exit(1);
  }
  
  runSpecificTest(testName);
} else {
  console.error('❌ 無効なオプションです。');
  showHelp();
  process.exit(1);
}