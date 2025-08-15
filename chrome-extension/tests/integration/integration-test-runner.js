/**
 * 統合テストランナー
 * 
 * Chrome拡張機能の統合テストを実行し、結果をレポートします。
 */

const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: [],
      startTime: null,
      endTime: null,
      duration: 0
    };
    
    this.performanceMetrics = {
      memoryUsage: [],
      executionTimes: [],
      resourceUsage: []
    };
  }

  /**
   * 統合テストスイートを実行
   */
  async runIntegrationTests() {
    console.log('🚀 Chrome拡張機能統合テスト開始');
    console.log('=' .repeat(60));
    
    this.testResults.startTime = Date.now();
    
    try {
      // 各統合テストスイートを実行
      await this.runTestSuite('component-communication.test.js', 'コンポーネント通信テスト');
      await this.runTestSuite('extension-lifecycle.test.js', '拡張機能ライフサイクルテスト');
      await this.runTestSuite('cross-website-functionality.test.js', 'クロスウェブサイト機能テスト');
      await this.runTestSuite('performance-memory.test.js', 'パフォーマンス・メモリテスト');
      
      this.testResults.endTime = Date.now();
      this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
      
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ 統合テスト実行中にエラーが発生しました:', error);
      process.exit(1);
    }
  }

  /**
   * 個別のテストスイートを実行
   */
  async runTestSuite(filename, displayName) {
    console.log(`\n📋 ${displayName} 実行中...`);
    
    const startTime = Date.now();
    const suiteResult = {
      name: displayName,
      filename: filename,
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0,
      memoryUsage: this.getMemoryUsage()
    };

    try {
      // Jest を使用してテストを実行
      const { execSync } = require('child_process');
      const testPath = path.join(__dirname, filename);
      
      const jestCommand = `npx jest "${testPath}" --json --verbose`;
      const result = execSync(jestCommand, { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '../../')
      });
      
      const jestResult = JSON.parse(result);
      
      // Jest結果を解析
      if (jestResult.testResults && jestResult.testResults.length > 0) {
        const testResult = jestResult.testResults[0];
        
        suiteResult.passed = testResult.numPassingTests || 0;
        suiteResult.failed = testResult.numFailingTests || 0;
        suiteResult.tests = testResult.assertionResults || [];
        
        this.testResults.passed += suiteResult.passed;
        this.testResults.failed += suiteResult.failed;
        this.testResults.total += suiteResult.passed + suiteResult.failed;
      }
      
      console.log(`✅ ${displayName}: ${suiteResult.passed} 成功, ${suiteResult.failed} 失敗`);
      
    } catch (error) {
      console.log(`❌ ${displayName}: テスト実行エラー`);
      console.error(error.message);
      suiteResult.failed = 1;
      this.testResults.failed += 1;
      this.testResults.total += 1;
    }
    
    suiteResult.duration = Date.now() - startTime;
    this.testResults.suites.push(suiteResult);
    
    // パフォーマンスメトリクスを記録
    this.recordPerformanceMetrics(displayName, suiteResult);
  }

  /**
   * メモリ使用量を取得
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  /**
   * パフォーマンスメトリクスを記録
   */
  recordPerformanceMetrics(suiteName, suiteResult) {
    this.performanceMetrics.memoryUsage.push({
      suite: suiteName,
      memory: suiteResult.memoryUsage,
      timestamp: Date.now()
    });
    
    this.performanceMetrics.executionTimes.push({
      suite: suiteName,
      duration: suiteResult.duration,
      testsCount: suiteResult.passed + suiteResult.failed
    });
  }

  /**
   * テスト結果レポートを生成
   */
  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 統合テスト結果サマリー');
    console.log('='.repeat(60));
    
    // 基本統計
    console.log(`総テスト数: ${this.testResults.total}`);
    console.log(`成功: ${this.testResults.passed} (${this.getPercentage(this.testResults.passed, this.testResults.total)}%)`);
    console.log(`失敗: ${this.testResults.failed} (${this.getPercentage(this.testResults.failed, this.testResults.total)}%)`);
    console.log(`実行時間: ${this.formatDuration(this.testResults.duration)}`);
    
    // スイート別結果
    console.log('\n📋 スイート別結果:');
    this.testResults.suites.forEach(suite => {
      const status = suite.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${suite.name}: ${suite.passed}/${suite.passed + suite.failed} (${this.formatDuration(suite.duration)})`);
    });
    
    // パフォーマンス分析
    console.log('\n⚡ パフォーマンス分析:');
    this.analyzePerformance();
    
    // 詳細レポートをファイルに保存
    await this.saveDetailedReport();
    
    // 結果に基づいて終了コードを設定
    if (this.testResults.failed > 0) {
      console.log('\n❌ 一部のテストが失敗しました');
      process.exit(1);
    } else {
      console.log('\n✅ すべてのテストが成功しました');
    }
  }

  /**
   * パフォーマンス分析を実行
   */
  analyzePerformance() {
    // 実行時間分析
    const totalExecutionTime = this.performanceMetrics.executionTimes.reduce(
      (sum, metric) => sum + metric.duration, 0
    );
    const averageExecutionTime = totalExecutionTime / this.performanceMetrics.executionTimes.length;
    
    console.log(`平均実行時間: ${this.formatDuration(averageExecutionTime)}`);
    
    // 最も遅いスイート
    const slowestSuite = this.performanceMetrics.executionTimes.reduce(
      (slowest, current) => current.duration > slowest.duration ? current : slowest
    );
    console.log(`最も遅いスイート: ${slowestSuite.suite} (${this.formatDuration(slowestSuite.duration)})`);
    
    // メモリ使用量分析
    const memoryUsages = this.performanceMetrics.memoryUsage.map(m => m.memory.heapUsed);
    const maxMemory = Math.max(...memoryUsages);
    const avgMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    
    console.log(`最大メモリ使用量: ${maxMemory} MB`);
    console.log(`平均メモリ使用量: ${Math.round(avgMemory)} MB`);
  }

  /**
   * 詳細レポートをファイルに保存
   */
  async saveDetailedReport() {
    const reportData = {
      summary: this.testResults,
      performance: this.performanceMetrics,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    const reportPath = path.join(__dirname, '../reports/integration-test-report.json');
    
    // レポートディレクトリを作成
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 詳細レポートを保存しました: ${reportPath}`);
    
    // HTML レポートも生成
    await this.generateHTMLReport(reportData);
  }

  /**
   * HTML レポートを生成
   */
  async generateHTMLReport(reportData) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chrome拡張機能統合テストレポート</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; flex: 1; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .suite { margin: 10px 0; padding: 10px; border-left: 4px solid #007bff; }
        .performance { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Chrome拡張機能統合テストレポート</h1>
        <p>実行日時: ${new Date(reportData.timestamp).toLocaleString('ja-JP')}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>総テスト数</h3>
            <div style="font-size: 2em; font-weight: bold;">${reportData.summary.total}</div>
        </div>
        <div class="metric">
            <h3>成功</h3>
            <div style="font-size: 2em; font-weight: bold;" class="success">${reportData.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>失敗</h3>
            <div style="font-size: 2em; font-weight: bold;" class="failure">${reportData.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>実行時間</h3>
            <div style="font-size: 2em; font-weight: bold;">${this.formatDuration(reportData.summary.duration)}</div>
        </div>
    </div>
    
    <h2>スイート別結果</h2>
    ${reportData.summary.suites.map(suite => `
        <div class="suite">
            <h3>${suite.name}</h3>
            <p>成功: <span class="success">${suite.passed}</span> | 失敗: <span class="failure">${suite.failed}</span> | 実行時間: ${this.formatDuration(suite.duration)}</p>
        </div>
    `).join('')}
    
    <div class="performance">
        <h2>パフォーマンス分析</h2>
        <table>
            <tr>
                <th>スイート</th>
                <th>実行時間</th>
                <th>メモリ使用量 (MB)</th>
                <th>テスト数</th>
            </tr>
            ${reportData.performance.executionTimes.map((exec, index) => `
                <tr>
                    <td>${exec.suite}</td>
                    <td>${this.formatDuration(exec.duration)}</td>
                    <td>${reportData.performance.memoryUsage[index]?.memory.heapUsed || 'N/A'}</td>
                    <td>${exec.testsCount}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <h2>環境情報</h2>
    <ul>
        <li>Node.js バージョン: ${reportData.environment.nodeVersion}</li>
        <li>プラットフォーム: ${reportData.environment.platform}</li>
        <li>アーキテクチャ: ${reportData.environment.arch}</li>
    </ul>
</body>
</html>`;

    const htmlPath = path.join(__dirname, '../reports/integration-test-report.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`📄 HTMLレポートを保存しました: ${htmlPath}`);
  }

  /**
   * パーセンテージを計算
   */
  getPercentage(value, total) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  /**
   * 時間をフォーマット
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }
}

// CLI実行時の処理
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Chrome拡張機能統合テストランナー

使用方法:
  node integration-test-runner.js [オプション]

オプション:
  --help, -h     このヘルプを表示
  --verbose, -v  詳細出力を有効化
  --suite <name> 特定のスイートのみ実行

例:
  node integration-test-runner.js
  node integration-test-runner.js --verbose
  node integration-test-runner.js --suite component-communication
`);
    process.exit(0);
  }
  
  runner.runIntegrationTests().catch(error => {
    console.error('統合テスト実行エラー:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;