/** @type {import('jest').Config} */
module.exports = {
  // テスト環境設定
  testEnvironment: 'jest-environment-jsdom',
  
  // ファイルパターン
  testMatch: [
    '**/?(*.)+(spec|test).js',
    '**/tests/**/*.test.js',
    '**/tests/integration/*.test.js'
  ],
  
  // カバレッジ設定
  collectCoverageFrom: [
    'background/*.js',
    'content/*.js',
    'popup/*.js',
    'options/*.js',
    'utils/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!node_modules/**',
    '!dist/**',
    '!tests/**'
  ],
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // テストタイムアウト
  testTimeout: 10000,
  
  // カバレッジレポート
  coverageReporters: ['text', 'lcov', 'html'],
  
  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // モジュールパス
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // 詳細出力
  verbose: true
};