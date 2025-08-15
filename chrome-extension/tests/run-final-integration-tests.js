#!/usr/bin/env node

/**
 * 広告プレビューシステム最終統合テスト実行スクリプト
 * 全機能の統合テストを実行し、詳細なレポートを生成
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FinalIntegrationTestRunner {
  constructor() {
    this.startTime = Date.now();
    this.testResults = new Map();
    this.config = {
      timeout: 600000, // 10分
      retryAttempts: 2,
      parallelTests: false,
      generateReport: true,
      reportFormats: ['json', 'html', 'junit'],
      coverageThreshold: 80
    };

    this.testSuites = [
      {
        name: 'Ad Preview System Integration',
        file: 'ad-preview-system-integration.test.js',
        timeout: 120000,
        critical: true
      },
      {
        name: 'Performance Optimization',
        file: 'performance-optimization.test.js',
        timeout: 60000,
        critical: true
      },
      {
        name: 'Privacy Protection',
        file: 'privacy-protection.test.js',
        timeout: 30000,
        critical: true
      },
      {
        name: 'User Choice Preview Integration',
        file: 'user-choice-preview-integration.test.js',
        timeout: 45000,
        critical: false
      },
      {
        name: 'Preview Gallery',
        file: 'preview-gallery.test.js',
        timeout: 30000,
        critical: false
      },
      {
        name: 'Bulk Operations',
        file: 'bulk-operations.test.js',
        timeout: 30000,
        critical: false
      },
      {
        name: 'Modal Functionality',
        file: 'modal-functionality.test.js',
        timeout: 30000,
        critical: false
      },
      {
        name: 'Usability Improvements',
        file: 'usability-improvements.test.js',
        timeout: 30000,
        critical: false
      },
      {
        name: 'Browser Compatibility',
        file: 'browser-compatibility.test.js',
        timeout: 45000,
        critical: false
      }
    ];
  }

  /**
   * 全テストスイートを実行
   */
  async runAllTests() {
    console.log('🚀 Starting Final Integration Tests for Ad Preview System\n');

    try {
      // 環境検証
      await this.validateEnvironment();

      // テスト前準備
      await this.setupTestEnvironment();

      // テストスイート実行
      if (this.config.parallelTests) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      // 結果分析
      const analysis = this.analyzeResults();

      // レポート生成
      if (this.config.generateReport) {
        await this.generateReports(analysis);
      }

      // 結果サマリー表示
      this.displaySummary(analysis);

      // 終了コード決定
      const exitCode = this.determineExitCode(analysis);

      console.log(`\n🏁 Final Integration Tests completed in ${this.getElapsedTime()}`);
      return { analysis, exitCode };

    } catch (error) {
      console.error('\n💥 Test execution failed:', error.message);
      throw error;
    }
  }

  /**
   * 環境検証
   */
  async validateEnvironment() {
    console.log('📋 Validating test environment...');

    const validations = [];

    // Node.js バージョン確認
    try {
      const nodeVersion = process.version;
      const isValidNode = this.compareVersion(nodeVersion.slice(1), '16.0.0') >= 0;
      validations.push({
        name: 'Node.js Version',
        passed: isValidNode,
        details: { version: nodeVersion, required: '>=16.0.0' }
      });
    } catch (error) {
      validations.push({
        name: 'Node.js Version',
        passed: false,
        details: { error: error.message }
      });
    }

    // Jest の確認
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      validations.push({
        name: 'Jest Availability',
        passed: true,
        details: { status: 'Available' }
      });
    } catch (error) {
      validations.push({
        name: 'Jest Availability',
        passed: false,
        details: { error: 'Jest not found' }
      });
    }

    // テストファイルの存在確認
    const missingFiles = this.testSuites.filter(suite =>
      !fs.existsSync(path.join(__dirname, suite.file))
    );

    validations.push({
      name: 'Test Files Existence',
      passed: missingFiles.length === 0,
      details: {
        total: this.testSuites.length,
        missing: missingFiles.map(f => f.file)
      }
    });

    // 必要なディレクトリの確認
    const requiredDirs = ['reports', 'coverage'];
    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    const allPassed = validations.every(v => v.passed);

    if (!allPassed) {
      console.error('❌ Environment validation failed:');
      validations.filter(v => !v.passed).forEach(v => {
        console.error(`   - ${v.name}: ${JSON.stringify(v.details)}`);
      });
      throw new Error('Environment validation failed');
    }

    console.log('✅ Environment validation passed\n');
  }

  /**
   * テスト環境のセットアップ
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    try {
      // テスト用の環境変数設定
      process.env.NODE_ENV = 'test';
      process.env.AD_PREVIEW_TEST_MODE = 'true';
      process.env.JEST_TIMEOUT = this.config.timeout.toString();

      // カバレッジディレクトリのクリア
      const coverageDir = path.join(__dirname, 'coverage');
      if (fs.existsSync(coverageDir)) {
        this.removeDirectory(coverageDir);
      }

      // レポートディレクトリのクリア
      const reportsDir = path.join(__dirname, 'reports');
      if (fs.existsSync(reportsDir)) {
        const files = fs.readdirSync(reportsDir);
        files.forEach(file => {
          if (file.startsWith('integration-test-')) {
            fs.unlinkSync(path.join(reportsDir, file));
          }
        });
      }

      console.log('✅ Test environment setup completed\n');

    } catch (error) {
      console.error('❌ Test environment setup failed:', error.message);
      throw error;
    }
  }

  /**
   * テストを順次実行
   */
  async runTestsSequentially() {
    console.log('🧪 Running test suites sequentially...\n');

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }
  }

  /**
   * テストを並列実行
   */
  async runTestsInParallel() {
    console.log('🧪 Running test suites in parallel...\n');

    const promises = this.testSuites.map(suite => this.runTestSuite(suite));
    await Promise.allSettled(promises);
  }

  /**
   * 個別テストスイートの実行
   */
  async runTestSuite(suite) {
    const startTime = Date.now();
    console.log(`📝 Running: ${suite.name}`);

    try {
      // Jest コマンドの構築
      const jestArgs = [
        '--testPathPattern', suite.file,
        '--verbose',
        '--coverage',
        '--coverageDirectory', path.join(__dirname, 'coverage', suite.name.replace(/\s+/g, '-')),
        '--testTimeout', suite.timeout.toString(),
        '--json',
        '--outputFile', path.join(__dirname, 'reports', `${suite.name.replace(/\s+/g, '-')}-result.json`)
      ];

      // Jest 実行
      const result = await this.executeJest(jestArgs, suite.timeout);

      const duration = Date.now() - startTime;
      const testResult = {
        suite: suite.name,
        file: suite.file,
        passed: result.success,
        duration,
        critical: suite.critical,
        details: result,
        timestamp: new Date().toISOString()
      };

      this.testResults.set(suite.name, testResult);

      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${suite.name} (${duration}ms)`);

      if (!result.success && suite.critical) {
        console.warn(`   ⚠️  Critical test failed: ${suite.name}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult = {
        suite: suite.name,
        file: suite.file,
        passed: false,
        duration,
        critical: suite.critical,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.set(suite.name, testResult);

      console.log(`   ❌ ${suite.name} (${duration}ms) - ${error.message}`);

      if (suite.critical) {
        console.error(`   🚨 Critical test suite failed: ${suite.name}`);
      }
    }
  }

  /**
   * Jest の実行
   */
  async executeJest(args, timeout) {
    return new Promise((resolve, reject) => {
      const jestProcess = spawn('npx', ['jest', ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      jestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jestProcess.on('close', (code) => {
        try {
          // Jest の JSON 出力を解析
          const lines = stdout.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));

          let jestResult = null;
          if (jsonLine) {
            jestResult = JSON.parse(jsonLine);
          }

          resolve({
            success: code === 0,
            exitCode: code,
            stdout,
            stderr,
            jestResult
          });
        } catch (error) {
          reject(new Error(`Failed to parse Jest output: ${error.message}`));
        }
      });

      jestProcess.on('error', (error) => {
        reject(new Error(`Jest execution failed: ${error.message}`));
      });

      // タイムアウト処理
      setTimeout(() => {
        jestProcess.kill('SIGTERM');
        reject(new Error(`Test suite timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * 結果分析
   */
  analyzeResults() {
    const results = Array.from(this.testResults.values());

    const analysis = {
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        critical: results.filter(r => r.critical).length,
        criticalFailed: results.filter(r => r.critical && !r.passed).length,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        averageDuration: 0
      },
      categories: {
        critical: results.filter(r => r.critical),
        nonCritical: results.filter(r => !r.critical),
        failed: results.filter(r => !r.passed),
        slow: results.filter(r => r.duration > 30000) // 30秒以上
      },
      performance: {
        fastest: results.reduce((min, r) => r.duration < min.duration ? r : min, results[0]),
        slowest: results.reduce((max, r) => r.duration > max.duration ? r : max, results[0]),
        averageTime: 0
      },
      coverage: {
        overall: 0,
        bySuite: {}
      },
      recommendations: []
    };

    // 平均時間の計算
    if (results.length > 0) {
      analysis.summary.averageDuration = Math.round(analysis.summary.totalDuration / results.length);
      analysis.performance.averageTime = analysis.summary.averageDuration;
    }

    // カバレッジ情報の収集
    this.collectCoverageInfo(analysis);

    // 推奨事項の生成
    this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * カバレッジ情報の収集
   */
  collectCoverageInfo(analysis) {
    try {
      const coverageDir = path.join(__dirname, 'coverage');
      if (fs.existsSync(coverageDir)) {
        const suites = fs.readdirSync(coverageDir);
        let totalStatements = 0;
        let coveredStatements = 0;

        suites.forEach(suite => {
          const coverageFile = path.join(coverageDir, suite, 'coverage-summary.json');
          if (fs.existsSync(coverageFile)) {
            const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
            const statements = coverage.total.statements;

            analysis.coverage.bySuite[suite] = {
              statements: statements.pct,
              branches: coverage.total.branches.pct,
              functions: coverage.total.functions.pct,
              lines: coverage.total.lines.pct
            };

            totalStatements += statements.total;
            coveredStatements += statements.covered;
          }
        });

        if (totalStatements > 0) {
          analysis.coverage.overall = Math.round((coveredStatements / totalStatements) * 100);
        }
      }
    } catch (error) {
      console.warn('Failed to collect coverage information:', error.message);
    }
  }

  /**
   * 推奨事項の生成
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // 失敗したテストに関する推奨事項
    if (analysis.summary.failed > 0) {
      recommendations.push({
        type: 'error',
        priority: 'high',
        message: `${analysis.summary.failed} test suite(s) failed. Review and fix failing tests before deployment.`,
        details: analysis.categories.failed.map(f => f.suite)
      });
    }

    // クリティカルテストの失敗
    if (analysis.summary.criticalFailed > 0) {
      recommendations.push({
        type: 'critical',
        priority: 'critical',
        message: `${analysis.summary.criticalFailed} critical test suite(s) failed. Deployment should be blocked.`,
        details: analysis.categories.failed.filter(f => f.critical).map(f => f.suite)
      });
    }

    // カバレッジに関する推奨事項
    if (analysis.coverage.overall < this.config.coverageThreshold) {
      recommendations.push({
        type: 'coverage',
        priority: 'medium',
        message: `Code coverage (${analysis.coverage.overall}%) is below threshold (${this.config.coverageThreshold}%). Add more tests.`,
        details: { current: analysis.coverage.overall, threshold: this.config.coverageThreshold }
      });
    }

    // パフォーマンスに関する推奨事項
    if (analysis.categories.slow.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'low',
        message: `${analysis.categories.slow.length} test suite(s) are running slowly (>30s). Consider optimization.`,
        details: analysis.categories.slow.map(s => ({ suite: s.suite, duration: s.duration }))
      });
    }

    // 成功時の推奨事項
    if (analysis.summary.failed === 0 && analysis.coverage.overall >= this.config.coverageThreshold) {
      recommendations.push({
        type: 'success',
        priority: 'info',
        message: 'All tests passed with adequate coverage. System is ready for deployment.',
        details: { passRate: '100%', coverage: `${analysis.coverage.overall}%` }
      });
    }

    analysis.recommendations = recommendations;
  }

  /**
   * レポート生成
   */
  async generateReports(analysis) {
    console.log('\n📊 Generating test reports...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(__dirname, 'reports');

    for (const format of this.config.reportFormats) {
      try {
        switch (format) {
          case 'json':
            await this.generateJSONReport(analysis, reportDir, timestamp);
            break;
          case 'html':
            await this.generateHTMLReport(analysis, reportDir, timestamp);
            break;
          case 'junit':
            await this.generateJUnitReport(analysis, reportDir, timestamp);
            break;
        }
      } catch (error) {
        console.warn(`Failed to generate ${format} report:`, error.message);
      }
    }
  }

  /**
   * JSON レポート生成
   */
  async generateJSONReport(analysis, reportDir, timestamp) {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: this.getElapsedTime(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      analysis,
      testResults: Object.fromEntries(this.testResults),
      configuration: this.config
    };

    const filePath = path.join(reportDir, `integration-test-report-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`   ✅ JSON report: ${filePath}`);
  }

  /**
   * HTML レポート生成
   */
  async generateHTMLReport(analysis, reportDir, timestamp) {
    const html = this.generateHTMLContent(analysis);
    const filePath = path.join(reportDir, `integration-test-report-${timestamp}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`   ✅ HTML report: ${filePath}`);
  }

  /**
   * JUnit レポート生成
   */
  async generateJUnitReport(analysis, reportDir, timestamp) {
    const xml = this.generateJUnitXML(analysis);
    const filePath = path.join(reportDir, `integration-test-report-${timestamp}.xml`);
    fs.writeFileSync(filePath, xml);
    console.log(`   ✅ JUnit report: ${filePath}`);
  }

  /**
   * HTML コンテンツ生成
   */
  generateHTMLContent(analysis) {
    const results = Array.from(this.testResults.values());

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ad Preview System - Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #007bff; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.danger { border-left-color: #dc3545; }
        .metric.warning { border-left-color: #ffc107; }
        .metric-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 14px; }
        .test-results { margin-bottom: 30px; }
        .test-item { background: white; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
        .test-header { padding: 15px; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center; }
        .test-name { font-weight: bold; }
        .test-status { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-critical { background: #dc3545; color: white; }
        .test-details { padding: 15px; display: none; }
        .test-details.show { display: block; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; }
        .recommendation { margin-bottom: 15px; padding: 10px; border-radius: 4px; }
        .rec-critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .rec-error { background: #f8d7da; border-left: 4px solid #dc3545; }
        .rec-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .rec-info { background: #d4edda; border-left: 4px solid #28a745; }
        .coverage-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%); transition: width 0.3s ease; }
        .toggle-btn { cursor: pointer; color: #007bff; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ad Preview System Integration Test Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Duration: ${this.getElapsedTime()}</p>
        </div>

        <div class="summary">
            <div class="metric ${analysis.summary.failed === 0 ? 'success' : 'danger'}">
                <div class="metric-value">${analysis.summary.passed}/${analysis.summary.total}</div>
                <div class="metric-label">Tests Passed</div>
            </div>
            <div class="metric ${analysis.summary.criticalFailed === 0 ? 'success' : 'danger'}">
                <div class="metric-value">${analysis.summary.critical - analysis.summary.criticalFailed}/${analysis.summary.critical}</div>
                <div class="metric-label">Critical Tests</div>
            </div>
            <div class="metric ${analysis.coverage.overall >= this.config.coverageThreshold ? 'success' : 'warning'}">
                <div class="metric-value">${analysis.coverage.overall}%</div>
                <div class="metric-label">Code Coverage</div>
            </div>
            <div class="metric">
                <div class="metric-value">${analysis.summary.averageDuration}ms</div>
                <div class="metric-label">Avg Duration</div>
            </div>
        </div>

        <div class="test-results">
            <h2>Test Results</h2>
            ${results.map(result => `
                <div class="test-item">
                    <div class="test-header">
                        <div>
                            <span class="test-name">${result.suite}</span>
                            ${result.critical ? '<span class="status-critical">CRITICAL</span>' : ''}
                        </div>
                        <div>
                            <span class="test-status ${result.passed ? 'status-passed' : 'status-failed'}">
                                ${result.passed ? 'PASSED' : 'FAILED'}
                            </span>
                            <span style="margin-left: 10px; color: #666;">${result.duration}ms</span>
                            <span class="toggle-btn" onclick="toggleDetails('${result.suite.replace(/\s+/g, '-')}')">Details</span>
                        </div>
                    </div>
                    <div class="test-details" id="details-${result.suite.replace(/\s+/g, '-')}">
                        <p><strong>File:</strong> ${result.file}</p>
                        <p><strong>Duration:</strong> ${result.duration}ms</p>
                        <p><strong>Timestamp:</strong> ${result.timestamp}</p>
                        ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="recommendations">
            <h2>Recommendations</h2>
            ${analysis.recommendations.map(rec => `
                <div class="recommendation rec-${rec.type}">
                    <strong>${rec.priority.toUpperCase()}:</strong> ${rec.message}
                    ${rec.details ? `<pre style="margin-top: 10px; font-size: 12px;">${JSON.stringify(rec.details, null, 2)}</pre>` : ''}
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
            <p>Report generated by Ad Preview System Integration Test Runner</p>
        </div>
    </div>

    <script>
        function toggleDetails(id) {
            const details = document.getElementById('details-' + id);
            details.classList.toggle('show');
        }
    </script>
</body>
</html>
    `;
  }

  /**
   * JUnit XML 生成
   */
  generateJUnitXML(analysis) {
    const results = Array.from(this.testResults.values());
    const totalTime = (analysis.summary.totalDuration / 1000).toFixed(3);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="Ad Preview System Integration Tests" tests="${analysis.summary.total}" failures="${analysis.summary.failed}" time="${totalTime}">\n`;

    results.forEach(result => {
      const time = (result.duration / 1000).toFixed(3);
      xml += `  <testsuite name="${result.suite}" tests="1" failures="${result.passed ? 0 : 1}" time="${time}">\n`;
      xml += `    <testcase name="${result.suite}" classname="${result.file}" time="${time}">\n`;

      if (!result.passed) {
        xml += `      <failure message="${result.error || 'Test failed'}">\n`;
        xml += `        <![CDATA[${result.error || 'Test suite failed'}]]>\n`;
        xml += `      </failure>\n`;
      }

      xml += `    </testcase>\n`;
      xml += `  </testsuite>\n`;
    });

    xml += `</testsuites>\n`;
    return xml;
  }

  /**
   * 結果サマリー表示
   */
  displaySummary(analysis) {
    console.log('\n📊 Test Results Summary:');
    console.log('═'.repeat(50));

    // 基本統計
    console.log(`Total Tests: ${analysis.summary.total}`);
    console.log(`Passed: ${analysis.summary.passed} ✅`);
    console.log(`Failed: ${analysis.summary.failed} ${analysis.summary.failed > 0 ? '❌' : '✅'}`);
    console.log(`Critical Tests: ${analysis.summary.critical - analysis.summary.criticalFailed}/${analysis.summary.critical} ${analysis.summary.criticalFailed === 0 ? '✅' : '❌'}`);
    console.log(`Code Coverage: ${analysis.coverage.overall}% ${analysis.coverage.overall >= this.config.coverageThreshold ? '✅' : '⚠️'}`);
    console.log(`Total Duration: ${this.getElapsedTime()}`);
    console.log(`Average Test Duration: ${analysis.summary.averageDuration}ms`);

    // 失敗したテスト
    if (analysis.summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      analysis.categories.failed.forEach(test => {
        const critical = test.critical ? ' (CRITICAL)' : '';
        console.log(`   - ${test.suite}${critical}: ${test.error || 'Test failed'}`);
      });
    }

    // 推奨事項
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => {
        const icon = rec.type === 'critical' ? '🚨' : rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${rec.message}`);
      });
    }

    console.log('═'.repeat(50));
  }

  /**
   * 終了コードの決定
   */
  determineExitCode(analysis) {
    // クリティカルテストが失敗した場合
    if (analysis.summary.criticalFailed > 0) {
      return 2; // Critical failure
    }

    // 通常のテストが失敗した場合
    if (analysis.summary.failed > 0) {
      return 1; // Test failure
    }

    // カバレッジが閾値を下回る場合
    if (analysis.coverage.overall < this.config.coverageThreshold) {
      return 1; // Coverage failure
    }

    return 0; // Success
  }

  /**
   * 経過時間の取得
   */
  getElapsedTime() {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * ディレクトリの再帰削除
   */
  removeDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            this.removeDirectory(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    } catch (error) {
      console.warn(`Failed to remove directory ${dirPath}:`, error.message);
    }
  }

  /**
   * バージョン比較
   */
  compareVersion(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }

    return 0;
  }
}

// メイン実行
async function main() {
  const runner = new FinalIntegrationTestRunner();

  try {
    const { analysis, exitCode } = await runner.runAllTests();

    // CI/CD 環境での結果出力
    if (process.env.CI) {
      console.log('\n🔄 CI/CD Integration:');
      console.log(`::set-output name=tests-total::${analysis.summary.total}`);
      console.log(`::set-output name=tests-passed::${analysis.summary.passed}`);
      console.log(`::set-output name=tests-failed::${analysis.summary.failed}`);
      console.log(`::set-output name=coverage::${analysis.coverage.overall}`);
      console.log(`::set-output name=critical-failed::${analysis.summary.criticalFailed}`);
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('\n💥 Test runner failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(3); // Runner failure
  }
}

// スクリプトとして実行された場合
if (require.main === module) {
  main();
}

module.exports = { FinalIntegrationTestRunner };