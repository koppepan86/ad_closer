# ポップアップ有効化ボタン修正

## 問題の概要

拡張機能のポップアップで「有効にする」ボタンが効かない問題が発生していました。

## 実施した修正

### 1. **toggleExtensionメソッドの強化**

#### 修正前の問題
- Chrome API の利用可能性チェックが不十分
- エラーハンドリングが不完全
- デバッグ情報が不足

#### 修正後の改善
```javascript
async toggleExtension(enabled) {
  try {
    // ユーザー設定を更新
    const preferences = await this.getUserPreferences();
    preferences.extensionEnabled = enabled;
    
    await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
    this.updateExtensionStatus(enabled);
    
    console.log(`拡張機能が${enabled ? '有効' : '無効'}になりました`);
  } catch (error) {
    console.error('拡張機能切り替えエラー:', error);
    this.showError('設定の保存に失敗しました');
  }
}
```

### 2. **sendMessageメソッドの改善**

#### 修正前の問題
- 通信エラーの適切な処理が不足
- フォールバック機能が不完全

#### 修正後の改善
```javascript
async sendMessage(type, data = null) {
  try {
    // 通信エラーハンドラーが利用可能な場合は使用
    if (typeof window !== 'undefined' && window.communicationErrorHandler) {
      const response = await window.communicationErrorHandler.sendMessage(
        { type, data },
        {
          timeout: 10000,
          fallback: true,
          callback: (error, result) => {
            if (error) {
              console.error('通信エラー:', error);
            }
          }
        }
      );
      
      if (response && response.success) {
        return response.data;
      } else {
        throw new Error(response?.error || 'メッセージ送信に失敗しました');
      }
    }
    
    // フォールバック: 従来の方法
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'メッセージ送信に失敗しました'));
        }
      });
    });
  } catch (error) {
    // エラーハンドラーに報告
    if (typeof window !== 'undefined' && window.globalErrorHandler) {
      window.globalErrorHandler.handleError(
        error,
        window.ERROR_TYPES.COMMUNICATION,
        window.ERROR_SEVERITY.MEDIUM,
        { component: 'popupInterface', operation: 'sendMessage', messageType: type }
      );
    }
    
    throw error;
  }
}
```

### 3. **ユーザーインタラクション通知の追加**

#### 新機能
- ユーザーがボタンをクリックした際にバックグラウンドスクリプトに通知
- activeTab権限の適切な取得をサポート

```javascript
async notifyUserInteraction(interactionType, data = {}) {
  try {
    await chrome.runtime.sendMessage({
      type: 'user_interaction',
      interactionType: interactionType,
      data: {
        ...data,
        timestamp: Date.now(),
        source: 'popup'
      }
    });
    console.log(`User interaction notified: ${interactionType}`);
  } catch (error) {
    console.error('Failed to notify user interaction:', error);
    // Don't throw - this is not critical for popup functionality
  }
}
```

### 4. **エラーハンドリングの強化**

#### 改善点
- より詳細なエラーメッセージ
- フォールバック機能の追加
- ユーザーフレンドリーなエラー表示

```javascript
showError(message) {
  console.error(message);
  
  // ステータステキストにエラーを表示
  const originalText = this.elements.statusText.textContent;
  const originalColor = this.elements.statusText.style.color;
  
  this.elements.statusText.textContent = 'エラー';
  this.elements.statusText.style.color = '#dc3545';
  
  setTimeout(() => {
    this.elements.statusText.textContent = originalText;
    this.elements.statusText.style.color = originalColor;
  }, 3000);
}
```

## 実施済みの追加修正

### 1. **DOM要素の存在確認とデバッグ情報の追加**

```javascript
// DOM要素の存在確認とデバッグ情報
console.log('DOM要素の取得結果:', {
  extensionToggle: !!this.elements.extensionToggle,
  statusText: !!this.elements.statusText,
  toggleSlider: !!this.elements.toggleSlider
});

if (!this.elements.extensionToggle) {
  console.error('拡張機能トグルボタンが見つかりません');
  throw new Error('必要なDOM要素が見つかりません: extension-toggle');
}
```

### 2. **イベントリスナー設定の改善**

```javascript
// 拡張機能トグル
if (this.elements.extensionToggle) {
  this.elements.extensionToggle.addEventListener('change', (e) => {
    console.log('拡張機能トグルボタンがクリックされました:', e.target.checked);
    this.notifyUserInteraction('toggle_extension');
    this.toggleExtension(e.target.checked);
  });
  console.log('拡張機能トグルのイベントリスナーが設定されました');
} else {
  console.error('拡張機能トグルボタンが見つからないため、イベントリスナーを設定できません');
}
```

### 3. **詳細なログとエラーハンドリングの追加**

- `toggleExtension`メソッドに詳細なログを追加
- エラー発生時にUIを元の状態に戻す処理を追加
- より具体的なエラーメッセージの表示

### 4. **テスト機能の追加**

ポップアップボタンの動作をテストするためのテストページを作成しました：
- `test-popup-button-fix-updated.html`

## テスト方法

### 基本テスト
1. 拡張機能をリロード
2. ポップアップを開く
3. 開発者ツールのコンソールを開く
4. 有効/無効切り替えボタンをクリック
5. コンソールで以下のログが表示されることを確認：
   - "拡張機能トグルボタンがクリックされました: true/false"
   - "拡張機能の切り替えを開始: 有効/無効"
   - "拡張機能が有効/無効になりました"
6. 設定が正しく保存されることを確認

### 詳細テスト（テストページ使用）
1. `test-popup-button-fix-updated.html` をブラウザで開く
2. "全テスト実行" ボタンをクリック
3. すべてのテストが成功することを確認
4. 特に以下のテストに注目：
   - Chrome APIs テスト
   - ユーザー設定テスト
   - 切り替え機能テスト
   - ポップアップインタラクションテスト

## 期待される結果

- ボタンクリック時に適切に状態が切り替わる
- エラーが発生した場合は適切なメッセージが表示される
- バックグラウンドスクリプトとの通信が正常に行われる
- ユーザーインタラクションが適切に記録される

## 注意事項

- この修正により、ポップアップの動作が改善されますが、バックグラウンドスクリプトでの対応する処理も必要です
- 権限エラーが発生する場合は、manifest.jsonの権限設定も確認してください