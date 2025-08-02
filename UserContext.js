import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from './firebaseConfig';
import Storage from '../utils/storage';
import NotificationService from '../utils/notificationService';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setUser(session?.user || null);
        setLoading(false);
        
        // Initialize notifications when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🔔 User signed in, initializing notifications...');
          await initializeNotifications();
        }
      }
    );

    // Load saved theme preference
    loadThemePreference();

    return () => subscription.unsubscribe();
  }, []);

  // Initialize notification service
  const initializeNotifications = async () => {
    try {
      console.log('🔔 Initializing notifications for user...');
      const token = await NotificationService.registerForPushNotificationsAsync();
      
      if (token) {
        console.log('✅ Notification token obtained and stored');
        setPushToken(token);
      } else {
        console.log('❌ Failed to obtain notification token');
      }
      
      // Set up notification listeners
      NotificationService.addNotificationReceivedListener((notification) => {
        console.log('📩 Notification received while app is open:', {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data
        });
      });
      
      NotificationService.addNotificationResponseReceivedListener((response) => {
        console.log('👆 User tapped notification:', {
          title: response.notification.request.content.title,
          body: response.notification.request.content.body,
          data: response.notification.request.content.data
        });
        
        // Handle notification tap - you can navigate to specific screens here
        const { type, postId } = response.notification.request.content.data || {};
        if (type && postId) {
          console.log(`🔗 User tapped ${type} notification for post ${postId}`);
          // You can add navigation logic here if needed
        }
      });
      
      console.log('✅ Notification listeners set up successfully');
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
  };

  const loadThemePreference = async () => {
    try {
      const savedSettings = await Storage.getItem('userSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setDarkMode(settings.darkMode ?? false);
        applyTheme(settings.darkMode ?? false);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const applyTheme = (isDark) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const root = document.documentElement;
      if (isDark) {
        root.style.setProperty('--background-color', '#1a1a1a');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--card-background', '#2d2d2d');
        root.style.setProperty('--border-color', '#404040');
        root.style.setProperty('--input-background', '#3a3a3a');
        root.style.setProperty('--shadow-color', 'rgba(0,0,0,0.3)');
      } else {
        root.style.setProperty('--background-color', '#f0f4f8');
        root.style.setProperty('--text-color', '#222222');
        root.style.setProperty('--card-background', '#ffffff');
        root.style.setProperty('--border-color', '#dddddd');
        root.style.setProperty('--input-background', '#f9f9f9');
        root.style.setProperty('--shadow-color', 'rgba(0,0,0,0.1)');
      }
    }
  };

  const toggleDarkMode = async (isDark) => {
    setDarkMode(isDark);
    applyTheme(isDark);
    
    // Save to cross-platform storage
    try {
      const savedSettings = await Storage.getItem('userSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      settings.darkMode = isDark;
      await Storage.setItem('userSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      
      // Clear any stored user data
      try {
        await Storage.removeItem('userProfile');
        await Storage.removeItem('userSettings');
      } catch (storageError) {
        console.warn('Error clearing storage during logout:', storageError);
      }
      
    } catch (error) {
      console.error('Error signing out:', error);
      // Still clear user state even if Supabase signout fails
      setUser(null);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      signOut, 
      loading,
      darkMode,
      toggleDarkMode,
      pushToken,
      initializeNotifications
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 