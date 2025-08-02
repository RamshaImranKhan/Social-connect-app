// Quick notification test script
import NotificationService from './utils/notificationService.js';

export const testNotifications = async () => {
  console.log('🧪 Testing notification system...');
  
  try {
    // Test 1: Register for notifications
    console.log('📱 Step 1: Registering for push notifications...');
    const token = await NotificationService.registerForPushNotificationsAsync();
    
    if (token) {
      console.log('✅ Token obtained:', token.substring(0, 30) + '...');
    } else {
      console.log('❌ Failed to get token');
      return;
    }
    
    // Test 2: Test notification sending (you can call this manually)
    console.log('📤 Step 2: Ready to test notification sending');
    console.log('💡 Like a post or add a comment to test notifications');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Auto-run test when imported
console.log('🔔 Notification test module loaded. Call testNotifications() to run tests.');
