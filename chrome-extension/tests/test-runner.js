/**
 * テストランナー - 全テストの実行と結果レポート
 * Task 9.1: ユニットテストの作成 - テスト実行スクリプト
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: null,
      duration: 0
    };
  }

  /**
   * 全テストを実行
   */
  async runAllTests() {
    console.log('🚀 Chrome拡張機能ユニットテスト実行開始\n');
    
    const startTime = Date.now();
    
    try {
      // Jest でテストを実行
      const jestCommand = 'npx jest --coverage --verbose --passWithNoTests';
      console.log('📋 実行コマンド:', jestCommand);
      console.log('─'.repeat(60));
      
      const output = execSync(jestCommand, { 
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe'
      });
      
      console.log(output);
      
      // テスト結果を解析
      this.parseTestResults(output);
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error.message);
      
      if (error.stdout) {
        console.log('\n📊 テスト出力:');
        console.log(error.stdout);
        this.parseTestResults(error.stdout);
      }
      
      if (error.stderr) {
        console.error('\n🚨 エラー詳細:');
        console.error(error.stderr);
      }
    }
    
    const endTime = Date.now();
    this.testResults.duration = endTime - startTime;
    
    // 結果レポートを生成
    this.generateReport();
    
    return this.testResults;
  }

  /**
   * テスト結果を解析
   */
  parseTestResults(output) {
    try {
      // Jest の出力からテスト結果を抽出
      const testSuiteMatch = output.match(/Test Suites: (\d+) passed(?:, (\d+) failed)?/);
      const testMatch = output.match(/Tests:\s+(\d+) passed(?:, (\d+) failed)?(?:, (\d+) skipped)?/);
      
      if (testMatch) {
        this.testResults.passed = parseInt(testMatch[1]) || 0;
        this.testResults.failed = parseInt(testMatch[2]) || 0;
        this.testResults.skipped = parseInt(testMatch[3]) || 0;
        this.testResults.total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
      }
      
      // カバレッジ情報を抽出
      const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        this.testResults.coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4])
        };
      }
      
    } catch (error) {
      console.warn('⚠️  テスト結果の解析に失敗:', error.message);
    }
  }

  /**
   * テスト結果レポートを生成
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 テスト実行結果レポート');
    console.log('='.repeat(60));
    
    // 基本統計
    console.log('\n📈 テスト統計:');
    console.log(`   総テスト数: ${this.testResults.total}`);
    console.log(`   ✅ 成功: ${this.testResults.passed}`);
    console.log(`   ❌ 失敗: ${this.testResults.failed}`);
    console.log(`   ⏭️  スキップ: ${this.testResults.skipped}`);
    console.log(`   ⏱️  実行時間: ${(this.testResults.duration / 1000).toFixed(2)}秒`);
    
    // 成功率
    const successRate = this.testResults.total > 0 ? 
      (this.testResults.passed / this.testResults.total * 100).toFixed(1) : 0;
    console.log(`   📊 成功率: ${successRate}%`);
    
    // カバレッジ情報
    if (this.testResults.coverage) {
      console.log('\n📋 コードカバレッジ:');
      console.log(`   文: ${this.testResults.coverage.statements}%`);
      console.log(`   分岐: ${this.testResults.coverage.branches}%`);
      console.log(`   関数: ${this.testResults.coverage.functions}%`);
      console.log(`   行: ${this.testResults.coverage.lines}%`);
    }
    
    // テストファイル一覧
    console.log('\n📁 実行されたテストファイル:');
    const testFiles = this.getTestFiles();
    testFiles.forEach(file => {
      console.log(`   • ${file}`);
    });
    
    // 結果判定
    console.log('\n' + '─'.repeat(60));
    if (this.testResults.failed === 0) {
      console.log('🎉 すべてのテストが成功しました！');
    } else {
      console.log(`⚠️  ${this.testResults.failed}個のテストが失敗しました`);
    }
    
    // カバレッジ警告
    if (this.testResults.coverage) {
      const minCoverage = 70;
      const lowCoverageAreas = [];
      
      if (this.testResults.coverage.statements < minCoverage) {
        lowCoverageAreas.push('文');
      }
      if (this.testResults.coverage.branches < minCoverage) {
        lowCoverageAreas.push('分岐');
      }
      if (this.testResults.coverage.functions < minCoverage) {
        lowCoverageAreas.push('関数');
      }
      if (this.testResults.coverage.lines < minCoverage) {
        lowCoverageAreas.push('行');
      }
      
      if (lowCoverageAreas.length > 0) {
        console.log(`📉 カバレッジが${minCoverage}%未満: ${lowCoverageAreas.join(', ')}`);
      }
    }
    
    console.log('='.repeat(60));
  }

  /**
   * テストファイル一覧を取得
   */
  getTestFiles() {
    const testDir = path.resolve(__dirname);
    const files = fs.readdirSync(testDir);
    
    return files
      .filter(file => file.endsWith('.test.js'))
      .map(file => file.replace('.test.js', ''))
      .sort();
  }

  /**
   * 個別テストファイルを実行
   */
  async runSpecificTest(testFile) {
    console.log(`🎯 個別テスト実行: ${testFile}`);
    
    try {
      const jestCommand = `npx jest ${testFile} --verbose`;
      const output = execSync(jestCommand, { 
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe'
      });
      
      console.log(output);
      return true;
      
    } catch (error) {
      console.error(`❌ テスト実行エラー (${testFile}):`, error.message);
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      return false;
    }
  }

  /**
   * ウォッチモードでテストを実行
   */
  async runWatchMode() {
    console.log('👀 ウォッチモードでテスト実行開始');
    console.log('ファイルの変更を監視してテストを自動実行します...');
    
    try {
      const jestCommand = 'npx jest --watch --verbose';
      execSync(jestCommand, { 
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit'
      });
      
    } catch (error) {
      console.error('❌ ウォッチモードエラー:', error.message);
    }
  }
}

// コマンドライン引数の処理
if (require.main === module) {
  const runner = new TestRunner();
  const args = process.argv.slice(2);
  
  if (args.includes('--watch')) {
    runner.runWatchMode();
  } else if (args.includes('--file') && args[args.indexOf('--file') + 1]) {
    const testFile = args[args.indexOf('--file') + 1];
    runner.runSpecificTest(testFile);
  } else {
    runner.runAllTests().then(results => {
      // 失敗したテストがある場合は終了コード1で終了
      process.exit(results.failed > 0 ? 1 : 0);
    });
  }
}

module.exports = TestRunner;