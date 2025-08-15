module.exports = {
  // 基本設定
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true
  },
  
  // パーサー設定
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  
  // プラグイン
  plugins: [
    '@typescript-eslint'
  ],
  
  // 継承設定
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking'
  ],
  
  // ルール設定
  rules: {
    // TypeScript固有
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // 一般的なルール
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Chrome拡張機能固有
    'no-undef': 'off' // chrome APIのため
  },
  
  // 除外設定
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js' // 設定ファイル除外
  ],
  
  // グローバル変数
  globals: {
    chrome: 'readonly'
  }
};