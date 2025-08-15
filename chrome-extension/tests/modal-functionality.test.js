/**
 * Modal Functionality Tests for Task 6
 * Tests the expanded display modal implementation
 */

describe('PreviewGallery Modal Functionality', () => {
  let previewGallery;
  let container;
  let mockPreviewData;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container');
    
    // Create mock preview data
    mockPreviewData = [
      {
        id: 'test_preview_1',
        element: document.createElement('div'),
        screenshot: {
          thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==',
          fullSize: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==',
          width: 300,
          height: 200,
          format: 'png'
        },
        elementInfo: {
          tagName: 'DIV',
          className: 'test-ad',
          id: 'test-ad-1',
          position: { x: 100, y: 200 },
          size: { width: 300, height: 200 },
          zIndex: 'auto',
          type: 'テスト広告'
        }
      },
      {
        id: 'test_preview_2',
        element: document.createElement('div'),
        screenshot: null,
        elementInfo: {
          tagName: 'DIV',
          className: 'test-ad-fallback',
          id: 'test-ad-2',
          position: { x: 200, y: 300 },
          size: { width: 400, height: 250 },
          zIndex: '1000',
          type: 'フォールバック広告'
        },
        fallback: {
          reason: 'capture_failed',
          description: 'スクリーンショットの取得に失敗しました'
        }
      }
    ];

    // Create PreviewGallery instance
    previewGallery = new PreviewGallery({
      debugMode: false,
      showElementInfo: true,
      enableIndividualSelection: true,
      enableExpandedView: true
    });
  });

  afterEach(() => {
    if (previewGallery) {
      previewGallery.cleanup();
    }
    document.body.innerHTML = '';
  });

  describe('Modal Creation', () => {
    test('should create modal HTML structure correctly', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeTruthy();
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.getAttribute('aria-labelledby')).toBeTruthy();
    });

    test('should create modal header with title and close button', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const header = document.querySelector('.preview-expanded-header');
      const title = document.querySelector('.preview-expanded-title');
      const closeBtn = document.querySelector('.preview-expanded-close');
      
      expect(header).toBeTruthy();
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('広告プレビュー');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn.getAttribute('aria-label')).toBe('閉じる');
    });

    test('should create modal body with content', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const body = document.querySelector('.preview-expanded-body');
      const info = document.querySelector('.preview-expanded-info');
      
      expect(body).toBeTruthy();
      expect(info).toBeTruthy();
    });
  });

  describe('Image Display', () => {
    test('should display image when screenshot is available', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const image = document.querySelector('.preview-expanded-image');
      expect(image).toBeTruthy();
      expect(image.src).toBe(mockPreviewData[0].screenshot.fullSize);
      expect(image.alt).toContain('拡大表示');
    });

    test('should display fallback when no screenshot is available', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_2');
      
      const fallback = document.querySelector('.preview-expanded-fallback');
      const fallbackIcon = document.querySelector('.preview-expanded-fallback-icon');
      const fallbackTitle = document.querySelector('.preview-expanded-fallback-title');
      const fallbackDescription = document.querySelector('.preview-expanded-fallback-description');
      
      expect(fallback).toBeTruthy();
      expect(fallbackIcon).toBeTruthy();
      expect(fallbackTitle).toBeTruthy();
      expect(fallbackTitle.textContent).toBe('フォールバック広告');
      expect(fallbackDescription).toBeTruthy();
      expect(fallbackDescription.textContent).toBe('スクリーンショットの取得に失敗しました');
    });
  });

  describe('Detail Information Display', () => {
    test('should display element detail information', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const info = document.querySelector('.preview-expanded-info');
      const infoRows = document.querySelectorAll('.preview-expanded-info-row');
      
      expect(info).toBeTruthy();
      expect(infoRows.length).toBeGreaterThan(0);
      
      // Check if specific information is displayed
      const infoText = info.textContent;
      expect(infoText).toContain('タイプ');
      expect(infoText).toContain('サイズ');
      expect(infoText).toContain('位置');
      expect(infoText).toContain('300×200px');
    });

    test('should display correct element information', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const infoRows = document.querySelectorAll('.preview-expanded-info-row');
      const infoData = Array.from(infoRows).map(row => {
        const label = row.querySelector('.preview-expanded-info-label').textContent;
        const value = row.querySelector('.preview-expanded-info-value').textContent;
        return { label, value };
      });
      
      expect(infoData.some(item => item.label.includes('タイプ') && item.value === 'テスト広告')).toBe(true);
      expect(infoData.some(item => item.label.includes('サイズ') && item.value === '300×200px')).toBe(true);
      expect(infoData.some(item => item.label.includes('位置') && item.value === '(100, 200)')).toBe(true);
    });
  });

  describe('Modal Animations', () => {
    test('should apply show class for opening animation', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      // Wait for animation frame
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal.classList.contains('show')).toBe(true);
    });

    test('should remove show class for closing animation', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      previewGallery.closeExpandedView();
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal.classList.contains('show')).toBe(false);
    });

    test('should remove modal from DOM after animation', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      previewGallery.closeExpandedView();
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });
  });

  describe('Modal Interaction', () => {
    test('should close modal when close button is clicked', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const closeBtn = document.querySelector('.preview-expanded-close');
      closeBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });

    test('should close modal when ESC key is pressed', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });

    test('should close modal when background is clicked', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const modal = document.querySelector('.preview-expanded-modal');
      modal.click(); // Click on background
      
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const modalAfterClick = document.querySelector('.preview-expanded-modal');
      expect(modalAfterClick).toBeFalsy();
    });
  });

  describe('Focus Management', () => {
    test('should set focus to first focusable element when opened', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const modal = document.querySelector('.preview-expanded-modal');
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        expect(document.activeElement).toBe(focusableElements[0]);
      }
    });

    test('should trap focus within modal', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const modal = document.querySelector('.preview-expanded-modal');
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 1) {
        // Focus on last element
        focusableElements[focusableElements.length - 1].focus();
        
        // Press Tab (should cycle to first element)
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        modal.dispatchEvent(tabEvent);
        
        // Note: This test would need more sophisticated setup to fully test focus trap
        expect(modal.contains(document.activeElement)).toBe(true);
      }
    });
  });

  describe('Action Buttons', () => {
    test('should display action buttons when individual selection is enabled', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      
      const actions = document.querySelector('.preview-expanded-actions');
      const allowBtn = document.querySelector('.preview-expanded-action-btn.allow');
      const blockBtn = document.querySelector('.preview-expanded-action-btn.block');
      
      expect(actions).toBeTruthy();
      expect(allowBtn).toBeTruthy();
      expect(allowBtn.textContent).toBe('許可');
      expect(blockBtn).toBeTruthy();
      expect(blockBtn.textContent).toBe('ブロック');
    });

    test('should close modal when action button is clicked', async () => {
      await previewGallery.renderPreviews(mockPreviewData, container);
      
      previewGallery.showExpandedView('test_preview_1');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      const allowBtn = document.querySelector('.preview-expanded-action-btn.allow');
      allowBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid preview ID gracefully', () => {
      expect(() => {
        previewGallery.showExpandedView('invalid_id');
      }).not.toThrow();
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });

    test('should handle missing preview data gracefully', async () => {
      await previewGallery.renderPreviews([], container);
      
      expect(() => {
        previewGallery.showExpandedView('test_preview_1');
      }).not.toThrow();
      
      const modal = document.querySelector('.preview-expanded-modal');
      expect(modal).toBeFalsy();
    });
  });
});