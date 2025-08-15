/**
 * Popup Interaction Notifier
 * ポップアップからService Workerにユーザーインタラクションを通知する
 */

console.log('Popup Interaction Notifier loaded');

/**
 * Notify Service Worker about popup interaction
 */
async function notifyPopupInteraction() {
  try {
    console.log('Popup: Notifying Service Worker about user interaction...');
    
    // Send message to Service Worker
    const response = await chrome.runtime.sendMessage({
      type: 'user_interaction',
      interactionType: 'popup_opened',
      data: {
        timestamp: Date.now(),
        source: 'popup',
        url: window.location.href
      }
    });
    
    console.log('Popup: Service Worker notification response:', response);
    return response;
  } catch (error) {
    console.error('Popup: Error notifying Service Worker:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize popup interaction detection
 */
function initializePopupInteraction() {
  console.log('Popup: Initializing interaction detection...');
  
  // Notify immediately when popup opens
  notifyPopupInteraction();
  
  // Add click listeners to popup elements
  document.addEventListener('click', (event) => {
    console.log('Popup: Click detected on element:', event.target.tagName);
    
    // Notify about popup interaction
    chrome.runtime.sendMessage({
      type: 'user_interaction',
      interactionType: 'popup_click',
      data: {
        timestamp: Date.now(),
        source: 'popup_click',
        element: event.target.tagName,
        elementId: event.target.id,
        elementClass: event.target.className
      }
    }).catch(error => {
      console.error('Popup: Error sending click notification:', error);
    });
  });
  
  // Add focus listener
  window.addEventListener('focus', () => {
    console.log('Popup: Focus detected');
    
    chrome.runtime.sendMessage({
      type: 'user_interaction',
      interactionType: 'popup_focus',
      data: {
        timestamp: Date.now(),
        source: 'popup_focus'
      }
    }).catch(error => {
      console.error('Popup: Error sending focus notification:', error);
    });
  });
  
  console.log('Popup: Interaction detection initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopupInteraction);
} else {
  initializePopupInteraction();
}

// Also initialize immediately for safety
setTimeout(initializePopupInteraction, 100);

// Export for manual testing
if (typeof window !== 'undefined') {
  window.notifyPopupInteraction = notifyPopupInteraction;
  window.testPopupInteraction = () => {
    console.log('Testing popup interaction...');
    return notifyPopupInteraction();
  };
}

console.log('Popup Interaction Notifier ready');