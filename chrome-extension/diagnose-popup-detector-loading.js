/**
 * PopupDetectorクラス読み込み診断スクリプト
 * ブラウザのコンソールで実行して、読み込み状況を詳細に診断する
 */

(function() {
  'use strict';

  console.log('🔍 PopupDetector Loading Diagnosis Started');
  console.log('='.repeat(50));

  // 基本情報
  console.log('📋 Basic Information:');
  console.log(`  - Current URL: ${window.location.href}`);
  console.log(`  - Document ready state: ${document.readyState}`);
  console.log(`  - Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // PopupDetectorクラスの状況
  console.log('🏗️ PopupDetector Class Status:');
  console.log(`  - PopupDetector type: ${typeof PopupDetector}`);
  console.log(`  - PopupDetector available: ${typeof PopupDetector === 'function'}`);
  
  if (typeof PopupDetector === 'function') {
    console.log(`  - PopupDetector name: ${PopupDetector.name}`);
    console.log(`  - PopupDetector prototype: ${!!PopupDetector.prototype}`);
    console.log(`  - Constructor available: ${typeof PopupDetector.prototype.constructor === 'function'}`);
    
    // プロトタイプメソッドの確認
    const methods = Object.getOwnPropertyNames(PopupDetector.prototype);
    console.log(`  - Prototype methods: ${methods.join(', ')}`);
  }
  console.log('');

  // PopupDetectorインスタンスの状況
  console.log('🎯 PopupDetector Instance Status:');
  console.log(`  - window.popupDetector type: ${typeof window.popupDetector}`);
  console.log(`  - Instance exists: ${!!window.popupDetector}`);
  
  if (window.popupDetector) {
    console.log(`  - Instance initialized: ${window.popupDetector.initialized}`);
    console.log(`  - Instance constructor: ${window.popupDetector.constructor.name}`);
    
    try {
      const stats = window.popupDetector.getStats();
      console.log(`  - Stats available: ${!!stats}`);
      console.log(`  - Stats:`, stats);
    } catch (error) {
      console.log(`  - Stats error: ${error.message}`);
    }
  }
  console.log('');

  // PopupDetectorGuardの状況
  console.log('🛡️ PopupDetectorGuard Status:');
  console.log(`  - PopupDetectorGuard type: ${typeof window.PopupDetectorGuard}`);
  console.log(`  - Guard available: ${!!window.PopupDetectorGuard}`);
  
  if (window.PopupDetectorGuard) {
    try {
      const isReady = window.PopupDetectorGuard.isReady();
      const status = window.PopupDetectorGuard.getStatus();
      console.log(`  - Guard ready: ${isReady}`);
      console.log(`  - Guard status:`, status);
    } catch (error) {
      console.log(`  - Guard error: ${error.message}`);
    }
  }
  console.log('');

  // ComponentRecoveryの状況
  console.log('🔧 ComponentRecovery Status:');
  console.log(`  - ComponentRecoveryManager type: ${typeof window.ComponentRecoveryManager}`);
  console.log(`  - ComponentRecovery available: ${!!window.ComponentRecoveryManager}`);
  
  if (window.ComponentRecoveryManager) {
    try {
      const recovery = new ComponentRecoveryManager();
      console.log(`  - Recovery instance created: ${!!recovery}`);
      
      // PopupDetectorのヘルスチェックを実行
      recovery.checkPopupDetectorHealth().then(result => {
        console.log(`  - PopupDetector health check result: ${result}`);
      }).catch(error => {
        console.log(`  - PopupDetector health check error: ${error.message}`);
      });
    } catch (error) {
      console.log(`  - ComponentRecovery error: ${error.message}`);
    }
  }
  console.log('');

  // スクリプトタグの確認
  console.log('📜 Script Tags Analysis:');
  const scripts = document.querySelectorAll('script[src]');
  const relevantScripts = [];
  
  scripts.forEach((script, index) => {
    const src = script.src;
    if (src.includes('popup-detector') || src.includes('component-recovery')) {
      relevantScripts.push({
        index,
        src: src.split('/').pop(),
        loaded: script.readyState !== 'loading'
      });
    }
  });
  
  console.log(`  - Total scripts: ${scripts.length}`);
  console.log(`  - Relevant scripts: ${relevantScripts.length}`);
  relevantScripts.forEach(script => {
    console.log(`    ${script.index}: ${script.src} (loaded: ${script.loaded})`);
  });
  console.log('');

  // エラーログの確認
  console.log('❌ Error Analysis:');
  
  // コンソールエラーをキャプチャ（可能な場合）
  const originalError = console.error;
  const errors = [];
  
  console.error = function(...args) {
    const errorMessage = args.join(' ');
    if (errorMessage.includes('PopupDetector')) {
      errors.push({
        timestamp: new Date().toISOString(),
        message: errorMessage
      });
    }
    originalError.apply(console, args);
  };
  
  setTimeout(() => {
    console.error = originalError;
    console.log(`  - PopupDetector related errors: ${errors.length}`);
    errors.forEach(error => {
      console.log(`    [${error.timestamp}] ${error.message}`);
    });
  }, 1000);

  // 推奨アクション
  console.log('💡 Recommendations:');
  
  if (typeof PopupDetector !== 'function') {
    console.log('  ❌ PopupDetector class not available');
    console.log('  🔧 Check if popup-detector-safe.js is loaded correctly');
    console.log('  🔧 Verify manifest.json script loading order');
    console.log('  🔧 Check for JavaScript errors preventing class definition');
  } else if (!window.popupDetector) {
    console.log('  ❌ PopupDetector instance not created');
    console.log('  🔧 Check content-script-clean.js initialization');
    console.log('  🔧 Verify automatic instance creation in popup-detector-safe.js');
  } else if (!window.popupDetector.initialized) {
    console.log('  ❌ PopupDetector instance not initialized');
    console.log('  🔧 Check initialization process in PopupDetector constructor');
    console.log('  🔧 Verify DOM readiness and initialization events');
  } else {
    console.log('  ✅ PopupDetector appears to be working correctly');
    console.log('  🔧 If issues persist, check component integration');
  }

  console.log('');
  console.log('='.repeat(50));
  console.log('🔍 PopupDetector Loading Diagnosis Completed');

  // 継続監視（オプション）
  console.log('');
  console.log('🔄 Starting continuous monitoring (10 seconds)...');
  
  let monitorCount = 0;
  const monitorInterval = setInterval(() => {
    monitorCount++;
    const status = {
      count: monitorCount,
      timestamp: new Date().toISOString(),
      classAvailable: typeof PopupDetector === 'function',
      instanceExists: !!window.popupDetector,
      instanceInitialized: window.popupDetector ? window.popupDetector.initialized : false,
      guardReady: window.PopupDetectorGuard ? window.PopupDetectorGuard.isReady() : false
    };
    
    console.log(`📊 Monitor ${monitorCount}:`, status);
    
    if (monitorCount >= 10) {
      clearInterval(monitorInterval);
      console.log('🔄 Continuous monitoring completed');
    }
  }, 1000);

})();