/**
 * プライバシー保護機能のテストスイート
 */

describe('Privacy Protection Features', () => {
  let privacyManager;
  let adPreviewCapture;
  let testElements;

  beforeEach(() => {
    // テスト用のDOM要素を作成
    document.body.innerHTML = `
      <div id="normalElement" class="ad-element">
        <h3>通常の広告</h3>
        <p>これは通常の広告コンテンツです。</p>
      </div>
      
      <div id="personalInfoElement" class="ad-element">
        <h3>個人情報含有</h3>
        <p>連絡先: john.doe@example.com</p>
        <p>電話番号: (555) 123-4567</p>
        <p>住所: 123 Main Street, Anytown</p>
      </div>
      
      <div id="sensitiveElement" class="ad-element">
        <h3>機密情報</h3>
        <p>クレジットカード: 4532-1234-5678-9012</p>
        <p>SSN: 123-45-6789</p>
      </div>
      
      <div id="japanesePersonalInfo" class="ad-element">
        <h3>日本の個人情報</h3>
        <p>郵便番号: 123-4567</p>
        <p>電話番号: 03-1234-5678</p>
        <p>メール: yamada@example.co.jp</p>
      </div>
      
      <div id="medicalElement" class="ad-element">
        <h3>医療情報</h3>
        <p>患者ID: P123456</p>
        <p>診療予約システム</p>
      </div>
    `;

    testElements = {
      normal: document.getElementById('normalElement'),
      personalInfo: document.getElementById('personalInfoElement'),
      sensitive: document.getElementById('sensitiveElement'),
      japanese: document.getElementById('japanesePersonalInfo'),
      medical: document.getElementById('medicalElement')
    };

    // PrivacyManagerのインスタンスを作成
    privacyManager = new PrivacyManager({
      debugMode: true,
      privacyLevel: 'medium',
      temporaryStorageEnabled: true,
      autoDeleteOnDialogClose: true,
      personalInfoDetectionEnabled: true,
      blurSensitiveContent: true,
      blurIntensity: 10
    });

    // AdPreviewCaptureのインスタンスを作成
    adPreviewCapture = new AdPreviewCapture({
      debugMode: true,
      privacyEnabled: true,
      privacyLevel: 'medium'
    });
  });

  afterEach(() => {
    // クリーンアップ
    if (privacyManager) {
      privacyManager.performEmergencyCleanup();
    }
    if (adPreviewCapture) {
      adPreviewCapture.cleanupTemporaryImages();
    }
    document.body.innerHTML = '';
  });

  describe('PrivacyManager', () => {
    describe('初期化', () => {
      test('正常に初期化される', async () => {
        expect(privacyManager).toBeDefined();
        expect(privacyManager.options.privacyLevel).toBe('medium');
        expect(privacyManager.options.temporaryStorageEnabled).toBe(true);
      });

      test('デフォルト設定が正しく設定される', () => {
        const defaultSettings = privacyManager.getDefaultPrivacySettings();
        expect(defaultSettings.privacyLevel).toBe('medium');
        expect(defaultSettings.temporaryStorageEnabled).toBe(true);
        expect(defaultSettings.autoDeleteOnDialogClose).toBe(true);
        expect(defaultSettings.personalInfoDetectionEnabled).toBe(true);
        expect(defaultSettings.blurSensitiveContent).toBe(true);
      });
    });

    describe('機密サイト検出', () => {
      test('通常のサイトは機密サイトとして検出されない', () => {
        const result = privacyManager.checkSensitiveSite('https://www.example.com');
        expect(result.isSensitive).toBe(false);
      });

      test('銀行サイトが機密サイトとして検出される', () => {
        const result = privacyManager.checkSensitiveSite('https://www.bank.com');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('default_domain');
        expect(result.matchedDomain).toBe('bank');
      });

      test('医療サイトが機密サイトとして検出される', () => {
        const result = privacyManager.checkSensitiveSite('https://www.medical-clinic.com');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('default_domain');
        expect(result.matchedDomain).toBe('medical');
      });

      test('政府サイトが機密サイトとして検出される', () => {
        const result = privacyManager.checkSensitiveSite('https://www.government.gov');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('default_domain');
        expect(result.matchedDomain).toBe('gov');
      });

      test('PayPalが機密サイトとして検出される', () => {
        const result = privacyManager.checkSensitiveSite('https://paypal.com/login');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('default_domain');
        expect(result.matchedDomain).toBe('paypal.com');
      });

      test('カスタム機密ドメインが検出される', async () => {
        await privacyManager.updatePrivacySettings({
          customSensitiveDomains: ['custom-bank.com', 'secret-site.org']
        });

        const result = privacyManager.checkSensitiveSite('https://custom-bank.com');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('custom_domain');
        expect(result.matchedDomain).toBe('custom-bank.com');
      });

      test('HTTPSでない金融サイトが検出される', () => {
        const result = privacyManager.checkSensitiveSite('http://insecure-bank.com');
        expect(result.isSensitive).toBe(true);
        expect(result.reason).toBe('insecure_sensitive');
      });
    });

    describe('個人情報検出', () => {
      test('通常要素では個人情報が検出されない', () => {
        const result = privacyManager.detectPersonalInfo(testElements.normal);
        expect(result.hasPersonalInfo).toBe(false);
      });

      test('メールアドレスが検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.personalInfo);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'email')).toBe(true);
      });

      test('電話番号が検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.personalInfo);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'phone')).toBe(true);
      });

      test('住所が検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.personalInfo);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'address')).toBe(true);
      });

      test('クレジットカード番号が検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.sensitive);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'creditCard')).toBe(true);
      });

      test('SSNが検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.sensitive);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'ssn')).toBe(true);
      });

      test('日本の郵便番号が検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.japanese);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'zipCodeJP')).toBe(true);
      });

      test('日本の電話番号が検出される', () => {
        const result = privacyManager.detectPersonalInfo(testElements.japanese);
        expect(result.hasPersonalInfo).toBe(true);
        expect(result.detectedInfo.some(info => info.type === 'phoneJP')).toBe(true);
      });

      test('個人情報検出が無効の場合は検出されない', async () => {
        await privacyManager.updatePrivacySettings({
          personalInfoDetectionEnabled: false
        });

        const result = privacyManager.detectPersonalInfo(testElements.personalInfo);
        expect(result.hasPersonalInfo).toBe(false);
        expect(result.reason).toBe('disabled');
      });
    });

    describe('プライバシー保護適用', () => {
      test('通常要素にはプライバシー保護が適用されない', async () => {
        const mockPreviewData = {
          id: 'test1',
          screenshot: { thumbnail: 'data:image/png;base64,test' },
          elementInfo: { tagName: 'DIV' }
        };

        const result = await privacyManager.applyPrivacyProtection(testElements.normal, mockPreviewData);
        expect(result.blocked).toBe(false);
        expect(result.protections).toHaveLength(0);
        expect(result.protectedData).toEqual(mockPreviewData);
      });

      test('個人情報含有要素にぼかし処理が適用される', async () => {
        const mockPreviewData = {
          id: 'test2',
          screenshot: { 
            thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
          },
          elementInfo: { tagName: 'DIV' }
        };

        const result = await privacyManager.applyPrivacyProtection(testElements.personalInfo, mockPreviewData);
        expect(result.blocked).toBe(false);
        expect(result.protections.some(p => p.type === 'personal_info')).toBe(true);
        expect(result.protections.some(p => p.type === 'blur_applied')).toBe(true);
        expect(result.protectedData.privacyProtection?.blurred).toBe(true);
      });

      test('高プライバシーレベルでは個人情報含有要素がブロックされる', async () => {
        await privacyManager.updatePrivacySettings({
          privacyLevel: 'high'
        });

        const mockPreviewData = {
          id: 'test3',
          screenshot: { thumbnail: 'data:image/png;base64,test' },
          elementInfo: { tagName: 'DIV' }
        };

        const result = await privacyManager.applyPrivacyProtection(testElements.personalInfo, mockPreviewData);
        expect(result.blocked).toBe(true);
        expect(result.protectedData.blocked).toBe(true);
        expect(result.protectedData.blockReason).toBe('personal_info');
      });

      test('機密サイトでプレビューがブロックされる', async () => {
        // 現在のURLを機密サイトに変更（モック）
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.bank.com/login' },
          writable: true
        });

        const mockPreviewData = {
          id: 'test4',
          screenshot: { thumbnail: 'data:image/png;base64,test' },
          elementInfo: { tagName: 'DIV' }
        };

        const result = await privacyManager.applyPrivacyProtection(testElements.normal, mockPreviewData);
        expect(result.blocked).toBe(true);
        expect(result.protectedData.blocked).toBe(true);
        expect(result.protectedData.blockReason).toBe('sensitive_site');
      });
    });

    describe('一時画像管理', () => {
      test('一時画像が正常に保存される', () => {
        const mockPreviewData = {
          id: 'temp1',
          screenshot: { thumbnail: 'data:image/png;base64,test' }
        };

        privacyManager.storeTemporaryImage(mockPreviewData);
        const stats = privacyManager.getPrivacyStats();
        expect(stats.temporaryImagesCount).toBe(1);
      });

      test('一時画像が正常にクリーンアップされる', () => {
        const mockPreviewData1 = { id: 'temp1', screenshot: { thumbnail: 'test1' } };
        const mockPreviewData2 = { id: 'temp2', screenshot: { thumbnail: 'test2' } };

        privacyManager.storeTemporaryImage(mockPreviewData1);
        privacyManager.storeTemporaryImage(mockPreviewData2);
        
        let stats = privacyManager.getPrivacyStats();
        expect(stats.temporaryImagesCount).toBe(2);

        privacyManager.cleanupTemporaryImages();
        stats = privacyManager.getPrivacyStats();
        expect(stats.temporaryImagesCount).toBe(0);
      });

      test('特定の一時画像のみクリーンアップされる', () => {
        const mockPreviewData1 = { id: 'temp1', screenshot: { thumbnail: 'test1' } };
        const mockPreviewData2 = { id: 'temp2', screenshot: { thumbnail: 'test2' } };

        privacyManager.storeTemporaryImage(mockPreviewData1);
        privacyManager.storeTemporaryImage(mockPreviewData2);

        privacyManager.cleanupTemporaryImages(['temp1']);
        const stats = privacyManager.getPrivacyStats();
        expect(stats.temporaryImagesCount).toBe(1);
      });

      test('期限切れ画像が自動的にクリーンアップされる', (done) => {
        // 短い保存時間を設定
        privacyManager.options.maxStorageTime = 100; // 100ms

        const mockPreviewData = {
          id: 'temp_expire',
          screenshot: { thumbnail: 'data:image/png;base64,test' }
        };

        privacyManager.storeTemporaryImage(mockPreviewData);
        
        setTimeout(() => {
          privacyManager.cleanupExpiredImages();
          const stats = privacyManager.getPrivacyStats();
          expect(stats.temporaryImagesCount).toBe(0);
          done();
        }, 150);
      });
    });

    describe('プライバシー設定管理', () => {
      test('プライバシー設定が正常に更新される', async () => {
        const newSettings = {
          privacyLevel: 'high',
          blurIntensity: 15,
          customSensitiveDomains: ['test.com']
        };

        await privacyManager.updatePrivacySettings(newSettings);
        const settings = privacyManager.getPrivacySettings();
        
        expect(settings.privacyLevel).toBe('high');
        expect(settings.blurIntensity).toBe(15);
        expect(settings.customSensitiveDomains).toContain('test.com');
      });

      test('プライバシー統計が正確に取得される', () => {
        const stats = privacyManager.getPrivacyStats();
        
        expect(stats).toHaveProperty('temporaryImagesCount');
        expect(stats).toHaveProperty('sensitiveElementsCount');
        expect(stats).toHaveProperty('privacyLevel');
        expect(stats).toHaveProperty('protectionEnabled');
        expect(stats.protectionEnabled).toHaveProperty('temporaryStorage');
        expect(stats.protectionEnabled).toHaveProperty('sensitiveDomainsEnabled');
        expect(stats.protectionEnabled).toHaveProperty('personalInfoDetection');
      });
    });

    describe('ぼかし効果', () => {
      test('画像にぼかし効果が適用される', async () => {
        const originalImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        
        const blurredImageData = await privacyManager.blurImage(originalImageData, 10);
        
        expect(blurredImageData).toBeDefined();
        expect(blurredImageData).toMatch(/^data:image\/png;base64,/);
        expect(blurredImageData).not.toBe(originalImageData);
      });

      test('ぼかし処理が無効の場合は元の画像が返される', async () => {
        await privacyManager.updatePrivacySettings({
          blurSensitiveContent: false
        });

        const mockPreviewData = {
          id: 'test_blur',
          screenshot: { 
            thumbnail: 'data:image/png;base64,original'
          }
        };

        const result = await privacyManager.applyPrivacyProtection(testElements.personalInfo, mockPreviewData);
        expect(result.protectedData.screenshot.thumbnail).toBe('data:image/png;base64,original');
      });
    });
  });

  describe('AdPreviewCapture統合', () => {
    beforeEach(async () => {
      // AdPreviewCaptureの初期化を待つ
      await adPreviewCapture.waitForInit();
    });

    test('プライバシーマネージャーが正常に統合される', () => {
      expect(adPreviewCapture.privacyManager).toBeDefined();
      expect(adPreviewCapture.privacyEnabled).toBe(true);
    });

    test('プライバシー設定が正常に更新される', async () => {
      const newSettings = {
        privacyLevel: 'high',
        blurIntensity: 20
      };

      await adPreviewCapture.updatePrivacySettings(newSettings);
      const settings = adPreviewCapture.getPrivacySettings();
      
      expect(settings.privacyLevel).toBe('high');
      expect(settings.blurIntensity).toBe(20);
    });

    test('機密サイトチェックが正常に動作する', () => {
      const result = adPreviewCapture.checkSensitiveSite('https://www.bank.com');
      expect(result.isSensitive).toBe(true);
    });

    test('個人情報検出が正常に動作する', () => {
      const result = adPreviewCapture.detectPersonalInfo(testElements.personalInfo);
      expect(result.hasPersonalInfo).toBe(true);
    });

    test('プライバシー統計が取得できる', () => {
      const stats = adPreviewCapture.getPrivacyStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('privacyLevel');
    });

    test('一時画像クリーンアップが動作する', () => {
      expect(() => {
        adPreviewCapture.cleanupTemporaryImages();
      }).not.toThrow();
    });

    test('プライバシー保護が無効の場合は適用されない', async () => {
      adPreviewCapture.setPrivacyEnabled(false);
      
      const mockPreviewData = {
        id: 'test_disabled',
        screenshot: { thumbnail: 'data:image/png;base64,test' }
      };

      const result = await adPreviewCapture.applyPrivacyProtection(testElements.personalInfo, mockPreviewData);
      expect(result.protections).toHaveLength(0);
      expect(result.blocked).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な要素での個人情報検出でエラーが発生しない', () => {
      expect(() => {
        privacyManager.detectPersonalInfo(null);
      }).not.toThrow();
    });

    test('無効なURLでの機密サイトチェックでエラーが発生しない', () => {
      expect(() => {
        privacyManager.checkSensitiveSite('invalid-url');
      }).not.toThrow();
    });

    test('無効な画像データでのぼかし処理でエラーが適切に処理される', async () => {
      const result = await privacyManager.blurImage('invalid-data', 10);
      expect(result).toBe('invalid-data'); // 元のデータが返される
    });

    test('プライバシー保護適用時のエラーが適切に処理される', async () => {
      const mockPreviewData = { id: 'error_test' };
      
      const result = await privacyManager.applyPrivacyProtection(null, mockPreviewData);
      expect(result.originalData).toBe(mockPreviewData);
      expect(result.protectedData).toBe(mockPreviewData);
    });
  });

  describe('パフォーマンス', () => {
    test('大量の一時画像でもメモリクリーンアップが正常に動作する', () => {
      // 大量の一時画像を作成
      for (let i = 0; i < 100; i++) {
        privacyManager.storeTemporaryImage({
          id: `temp_${i}`,
          screenshot: { thumbnail: `data_${i}` }
        });
      }

      let stats = privacyManager.getPrivacyStats();
      expect(stats.temporaryImagesCount).toBe(100);

      // メモリ使用量チェックを実行
      privacyManager.checkMemoryUsage();
      
      stats = privacyManager.getPrivacyStats();
      expect(stats.temporaryImagesCount).toBeLessThan(100); // 一部が削除される
    });

    test('個人情報検出が高速に実行される', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        privacyManager.detectPersonalInfo(testElements.personalInfo);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100); // 100ms以内
    });

    test('機密サイトチェックが高速に実行される', () => {
      const testUrls = [
        'https://www.example.com',
        'https://www.bank.com',
        'https://www.medical.com',
        'https://www.government.gov',
        'https://paypal.com'
      ];

      const startTime = Date.now();
      
      testUrls.forEach(url => {
        privacyManager.checkSensitiveSite(url);
      });
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(50); // 50ms以内
    });
  });
});