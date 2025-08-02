import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { supabase } from './firebaseConfig';
import { useUser } from './UserContext';
import Storage from '../utils/storage';

export default function SettingsScreen() {
  const { user, signOut, darkMode, toggleDarkMode } = useUser();

  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    gender: ''
  });

  // Settings states
  const [notifications, setNotifications] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Password change modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);



  useEffect(() => {
    const initializeApp = async () => {
      await fetchProfile();
      await loadSettings();
    };
    initializeApp();
  }, []);

  const loadSettings = async () => {
    // Load saved settings with fallback for mobile compatibility
    try {
      let savedSettings = null;
      
      try {
        savedSettings = await Storage.getItem('userSettings');
      } catch (storageError) {
        console.warn('Storage error, using defaults:', storageError);
        // Set default values if storage fails
        setNotifications(true);
        setPrivacyMode(false);
        setEmailNotifications(true);
        return;
      }
      
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setNotifications(settings.notifications ?? true);
          setPrivacyMode(settings.privacyMode ?? false);
          setEmailNotifications(settings.emailNotifications ?? true);
        } catch (parseError) {
          console.warn('Error parsing settings, using defaults:', parseError);
          // Use defaults if parsing fails
          setNotifications(true);
          setPrivacyMode(false);
          setEmailNotifications(true);
        }
      } else {
        // No saved settings, use defaults
        setNotifications(true);
        setPrivacyMode(false);
        setEmailNotifications(true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fallback to defaults
      setNotifications(true);
      setPrivacyMode(false);
      setEmailNotifications(true);
    }
  };

  const saveSettings = async () => {
    const settings = {
      notifications,
      darkMode,
      privacyMode,
      emailNotifications
    };
    
    try {
      try {
        await Storage.setItem('userSettings', JSON.stringify(settings));
        Alert.alert('Success', 'Settings saved successfully');
      } catch (storageError) {
        console.error('Storage save error:', storageError);
        Alert.alert('Warning', 'Settings may not persist properly');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const fetchProfile = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      // First try to load from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!error && data) {
        // Supabase data found
        setProfile(data);
        setFormData({
          name: data.name || '',
          gender: data.gender || ''
        });
      } else {
        // Supabase failed, try Storage backup
        console.warn('Supabase profile fetch failed, trying Storage backup:', error);
        
        let profileData = null;
        try {
          const savedProfile = await Storage.getItem('userProfile');
          if (savedProfile) {
            profileData = JSON.parse(savedProfile);
          }
        } catch (parseErr) {
          console.error('Error parsing stored profile:', parseErr);
        }

        if (profileData) {
          setProfile(profileData);
          setFormData({
            name: profileData.name || '',
            gender: profileData.gender || ''
          });
        } else {
          // No data found anywhere
          setProfile({});
          setFormData({
            name: '',
            gender: ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    // Try Storage as final fallback
    let profileData = null;
    try {
      const savedProfile = await Storage.getItem('userProfile');
      if (savedProfile) {
        profileData = JSON.parse(savedProfile);
      }
    } catch (parseErr) {
      console.error('Error parsing stored profile in fallback:', parseErr);
    }

    if (profileData) {
      setProfile(profileData);
      setFormData({
        name: profileData.name || '',
        gender: profileData.gender || ''
      });
    } else {
      setProfile({});
      setFormData({
        name: '',
        gender: ''
      });
    }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'User email not found');
      return;
    }

    // Validate form data
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    try {
      console.log('Saving profile data:', {
        email: user.email,
        name: formData.name,
        gender: formData.gender
      });

      // Try to save profile data to Supabase first (primary storage)
      const profileData = {
        user_id: user.id,
        email: user.email,
        name: formData.name.trim(),
        gender: formData.gender.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      };

      // Save to Supabase database first
      const { error } = await supabase
        .from('profiles')
        .upsert([profileData]);

      if (error) {
        console.error('Supabase error:', error);
        Alert.alert('Error', `Failed to save profile to database: ${error.message}`);
        return;
      }
      
      console.log('Profile successfully saved to Supabase database:', profileData);
      
      // Also save to localStorage as backup
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        console.log('Profile also backed up to localStorage');
      }
      
      // Save settings to localStorage as well
      saveSettings();
      
      Alert.alert('Success', 'Profile and settings saved successfully to database!');
      fetchProfile(); // Refresh profile data
      
    } catch (err) {
      console.error('Save profile error:', err);
      const errorMessage = err && err.message ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to update profile: ${errorMessage}`);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    try {
      console.log('Starting password change process...');
      
      // Get current session to ensure user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No active session found:', sessionError);
        Alert.alert('Error', 'Please log in again to change your password');
        return;
      }

      console.log('Active session found, proceeding with password verification...');
      
      // Verify current password by attempting to sign in with it
      const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword
      });

      if (verifyError) {
        console.error('Current password verification failed:', verifyError);
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }

      console.log('Current password verified successfully');

      // Wait a moment to ensure the session is properly established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now update the password for the authenticated user
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        console.error('Password update failed:', updateError);
        Alert.alert('Error', `Failed to update password: ${updateError.message}`);
        return;
      }

      console.log('Password updated successfully:', updateData);
      
      // Clear the form and close modal
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswords(false);
      setPasswordModalVisible(false);
      
      Alert.alert(
        'Success', 
        'Password updated successfully! Please use your new password for future logins.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('Password change completed successfully');
            }
          }
        ]
      );
      
    } catch (err) {
      console.error('Unexpected error during password change:', err);
      Alert.alert('Error', `Failed to update password: ${err.message || 'Unknown error'}`);
    }
  };



  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete profile data
              await supabase
                .from('profiles')
                .delete()
                .eq('email', user.email);

              // Delete user account
              await supabase.auth.admin.deleteUser(user.id);
              
              Alert.alert('Success', 'Account deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = (value) => {
    setNotifications(value);
    saveSettings();
    Alert.alert('Notifications', value ? 'Push notifications enabled' : 'Push notifications disabled');
  };

  const handleEmailNotificationToggle = (value) => {
    setEmailNotifications(value);
    saveSettings();
    Alert.alert('Email Notifications', value ? 'Email notifications enabled' : 'Email notifications disabled');
  };

  const handlePrivacyToggle = (value) => {
    setPrivacyMode(value);
    saveSettings();
    Alert.alert('Privacy', value ? 'Profile is now private' : 'Profile is now public');
  };

  const handleDarkModeToggle = (value) => {
    toggleDarkMode(value);
    saveSettings();
    Alert.alert('Theme', value ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handleLogout = async () => {
    try {
      console.log('Starting logout process...');
      await signOut();
      
      // Clear any cached data and navigate to login
      console.log('Logout successful - clearing cache and navigating to login');
      
      // Small delay to ensure state is cleared
      setTimeout(() => {
        router.replace('/loginScreen');
      }, 100);
      
    } catch (error) {
      console.error('Error during logout:', error);
      // Even on error, try to navigate to login
      console.log('Logout error occurred, forcing navigation to login');
      router.replace('/loginScreen');
    }
  };

  const formatGender = (gender) => {
    switch (gender) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'prefer_not_to_say': return 'Prefer not to say';
      default: return gender;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, darkMode && styles.containerDark]}>
        <Text style={[styles.loadingText, darkMode && styles.textDark]}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, darkMode && styles.containerDark]}>
      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.title, darkMode && styles.textDark]}>Settings</Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Profile Settings</Text>
          
          <View>
            <View style={[styles.displayField, darkMode && styles.displayFieldDark]}>
              <Text style={[styles.displayLabel, darkMode && styles.textDark]}>Full Name:</Text>
              <Text style={[styles.displayValue, darkMode && styles.textDark]}>
                {formData.name || 'Not set'}
              </Text>
            </View>
            <View style={[styles.displayField, darkMode && styles.displayFieldDark]}>
              <Text style={[styles.displayLabel, darkMode && styles.textDark]}>Email:</Text>
              <Text style={[styles.displayValue, darkMode && styles.textDark]}>
                {user?.email || 'Not available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Privacy Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Private Profile</Text>
            <Switch
              value={privacyMode}
              onValueChange={handlePrivacyToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={privacyMode ? '#4F8EF7' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Notification Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Push Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={notifications ? '#4F8EF7' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Email Notifications</Text>
            <Switch
              value={emailNotifications}
              onValueChange={handleEmailNotificationToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={emailNotifications ? '#4F8EF7' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Appearance Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={darkMode ? '#4F8EF7' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.buttonSpacing} />
          <Button 
            title="Save Settings" 
            onPress={saveSettings} 
            color="#4CAF50" 
          />
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Account Actions</Text>
          
          <Button 
            title="Change Password" 
            onPress={() => setPasswordModalVisible(true)} 
            color="#4F8EF7" 
          />
          

          
          <Button 
            title="Delete Account" 
            onPress={handleDeleteAccount} 
            color="#E57373" 
          />
          
          <View style={styles.buttonSpacing} />
          
          <Button 
            title="Logout" 
            onPress={handleLogout} 
            color="#FF9800" 
          />
        </View>
      </View>

      {/* Password Change Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Change Password</Text>
            
            <TextInput
              placeholder="Current Password"
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
              secureTextEntry={!showPasswords}
              style={[styles.input, darkMode && styles.inputDark]}
              placeholderTextColor={darkMode ? '#888' : '#666'}
            />
            
            <TextInput
              placeholder="New Password"
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
              secureTextEntry={!showPasswords}
              style={[styles.input, darkMode && styles.inputDark]}
              placeholderTextColor={darkMode ? '#888' : '#666'}
            />
            
            <TextInput
              placeholder="Confirm New Password"
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
              secureTextEntry={!showPasswords}
              style={[styles.input, darkMode && styles.inputDark]}
              placeholderTextColor={darkMode ? '#888' : '#666'}
            />
            
            {/* Show/Hide Password Toggle */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Show Passwords</Text>
              <Switch
                value={showPasswords}
                onValueChange={setShowPasswords}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={showPasswords ? '#4F8EF7' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.buttonRow}>
              <Button title="Update Password" onPress={handleChangePassword} color="#4F8EF7" />
              <Button title="Cancel" onPress={() => setPasswordModalVisible(false)} color="#E57373" />
            </View>
          </View>
        </View>
      </Modal>


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#2d2d2d',
    shadowColor: 'rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 24,
    textAlign: 'center',
  },
  textDark: {
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  info: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  inputDark: {
    borderColor: '#404040',
    backgroundColor: '#3a3a3a',
    color: '#ffffff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  buttonSpacing: {
    height: 12,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#2d2d2d',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  displayField: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  displayFieldDark: {
    backgroundColor: '#3a3a3a',
    borderColor: '#555',
  },
  displayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  displayValue: {
    fontSize: 16,
    color: '#333',
  },

}); 