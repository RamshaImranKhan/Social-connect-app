import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './firebaseConfig';
import { useUser } from './UserContext';
import Storage from '../utils/storage';

export default function ProfileScreen() {
  const { user, signOut, loading: userLoading, darkMode } = useUser();
  const params = useLocalSearchParams();
  const email = params.email || user?.email;
  const isCurrentUser = email === user?.email;
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    gender: ''
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    gender: ''
  });

  // Get profile name with immediate localStorage check
  const getProfileName = () => {
    // First check the loaded profile
    if (profile.name && profile.name.trim()) {
      return profile.name;
    }
    
    // Check form data if we're editing
    if (editFormData.name && editFormData.name.trim()) {
      return editFormData.name;
    }
    
    // Fallback to localStorage (web-only, safely guarded)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          const data = JSON.parse(savedProfile);
          if (data.name && data.name.trim()) {
            return data.name;
          }
        }
      } catch (e) {
        console.error('Error parsing localStorage:', e);
      }
    }
    
    // If no name is found, return email username part or 'User'
    if (email) {
      const username = email.split('@')[0];
      return username || 'User';
    }
    
    return 'User';
  };

  // Get profile picture with user-specific localStorage fallback
  const getProfilePicture = () => {
    // First check the loaded profile data from database
    if (profile.profile_picture) {
      return profile.profile_picture;
    }
    
    // Check current state
    if (profilePicture) {
      return profilePicture;
    }
    
    // Only check localStorage if this is the current user (web-only, safely guarded)
    // This prevents showing other users' cached profile pictures
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && isCurrentUser) {
      try {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          const data = JSON.parse(savedProfile);
          // Double check the email matches to ensure we're not showing wrong user's picture
          if (data.email === email && data.profile_picture) {
            return data.profile_picture;
          }
        }
      } catch (e) {
        console.error('Error parsing localStorage for profile picture:', e);
      }
    }
    
    // Return null to show default avatar
    return null;
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async () => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        // Web implementation
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (event) => {
          const file = event.target.files[0];
          if (file) {
            // Check file size (limit to 5MB)
            if (file.size > 5 * 1024 * 1024) {
              Alert.alert('Error', 'Image size should be less than 5MB');
              return;
            }
            
            // Convert to base64 for storage
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64Image = e.target.result;
              setProfilePicture(base64Image);
              saveProfilePicture(base64Image);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else {
        // Mobile implementation using expo-image-picker
        console.log('Opening image picker for profile picture...');
        
        // Request permissions first
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload profile pictures!');
          return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1], // Square aspect ratio for profile pictures
          quality: 0.7,
          base64: true // Get base64 for cross-platform compatibility
        });
        
        console.log('Profile picture picker result:', {
          canceled: result.canceled,
          hasAssets: !!result.assets,
          assetsLength: result.assets?.length
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedImage = result.assets[0];
          console.log('Selected profile image details:', {
            uri: selectedImage.uri,
            hasBase64: !!selectedImage.base64,
            width: selectedImage.width,
            height: selectedImage.height,
            fileSize: selectedImage.fileSize
          });
          
          if (!selectedImage.uri) {
            console.error('No URI in selected profile image');
            Alert.alert('Error', 'Could not access the selected image. Please try again.');
            return;
          }
          
          if (!selectedImage.base64) {
            console.error('No base64 data in selected profile image');
            Alert.alert('Error', 'Could not process the selected image. Please try again.');
            return;
          }
          
          // Check file size (estimate from base64 length, limit to ~5MB)
          const estimatedSize = (selectedImage.base64.length * 3) / 4;
          if (estimatedSize > 5 * 1024 * 1024) {
            Alert.alert('Error', 'Image size should be less than 5MB. Please choose a smaller image.');
            return;
          }
          
          // Create base64 data URL for consistency with web
          const base64Image = `data:image/jpeg;base64,${selectedImage.base64}`;
          
          console.log('Mobile profile picture processing:', {
            base64Length: selectedImage.base64.length,
            dataUrlLength: base64Image.length,
            userEmail: user?.email,
            userId: user?.id
          });
          
          // Update UI immediately
          setProfilePicture(base64Image);
          console.log('Profile picture state updated in UI');
          
          // Save to database
          console.log('Starting mobile profile picture save to database...');
          const saveResult = await saveProfilePicture(base64Image);
          
          if (saveResult) {
            console.log('Mobile profile picture save process completed successfully');
          } else {
            console.error('Mobile profile picture save process failed');
            // Reset UI state if save failed
            setProfilePicture(null);
          }
        } else {
          console.log('Profile picture selection canceled');
        }
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    }
  };

  // Save profile picture to storage
  const saveProfilePicture = async (imageData) => {
    try {
      console.log('=== SAVE PROFILE PICTURE DEBUG START ===');
      console.log('Platform:', Platform.OS);
      console.log('Image data type:', typeof imageData);
      console.log('Image data length:', imageData?.length);
      console.log('User object:', {
        hasUser: !!user,
        email: user?.email,
        id: user?.id
      });
      
      // Validate required data
      if (!user?.email) {
        console.error('User email not found - cannot save profile picture');
        console.error('User object details:', user);
        Alert.alert('Error', 'User authentication required. Please log in again.');
        return false;
      }
      
      if (!imageData || typeof imageData !== 'string') {
        console.error('Invalid image data provided');
        Alert.alert('Error', 'Invalid image data. Please try selecting the image again.');
        return false;
      }
      
      // Validate base64 image data
      if (!imageData.startsWith('data:image/')) {
        console.error('Image data is not in proper base64 format');
        Alert.alert('Error', 'Invalid image format. Please try again.');
        return false;
      }
      
      console.log('Validation passed, proceeding with database save...');
      
      // Try to get existing profile first
      console.log('Fetching existing profile data...');
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .single();
      
      console.log('Existing profile:', existingProfile);
      
      // Prepare profile data for upsert
      const profileData = {
        user_id: user.id,
        email: user.email,
        name: existingProfile?.name || profile.name || formData.name || user.email.split('@')[0],
        gender: existingProfile?.gender || profile.gender || formData.gender || '',
        profile_picture: imageData,
        // Keep existing created_at if it exists, otherwise use current time
        created_at: existingProfile?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Profile data prepared for upsert:', {
        user_id: profileData.user_id,
        email: profileData.email,
        name: profileData.name,
        gender: profileData.gender,
        hasProfilePicture: !!profileData.profile_picture,
        profilePictureLength: profileData.profile_picture?.length,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at
      });

      // Use a more reliable approach: check if profile exists and update/insert accordingly
      if (existingProfile) {
        console.log('Profile exists, updating with new picture...');
        
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ 
            profile_picture: imageData,
            name: profileData.name, // Also update name and gender if changed
            gender: profileData.gender,
            updated_at: new Date().toISOString()
          })
          .eq('email', user.email)
          .select();
          
        if (updateError) {
          console.error('Failed to update profile picture:', updateError);
          console.error('Update error details:', {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code
          });
          Alert.alert('Error', `Failed to save profile picture: ${updateError.message}`);
          return false;
        }
        
        console.log('Profile picture updated successfully');
        console.log('Updated data:', updateData);
        
      } else {
        console.log('No existing profile found, creating new profile...');
        
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert([profileData])
          .select();
          
        if (insertError) {
          console.error('Failed to insert new profile:', insertError);
          console.error('Insert error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          
          // If insert fails due to duplicate key, try to update instead
          if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
            console.log('Duplicate key detected, trying update instead...');
            
            const { data: updateData, error: updateError } = await supabase
              .from('profiles')
              .update({ 
                profile_picture: imageData,
                name: profileData.name,
                gender: profileData.gender,
                updated_at: new Date().toISOString()
              })
              .eq('email', user.email)
              .select();
              
            if (updateError) {
              console.error('Fallback update also failed:', updateError);
              Alert.alert('Error', `Failed to save profile picture: ${updateError.message}`);
              return false;
            }
            
            console.log('Profile picture saved via fallback update');
            console.log('Fallback update data:', updateData);
          } else {
            Alert.alert('Error', `Failed to save profile picture: ${insertError.message}`);
            return false;
          }
        } else {
          console.log('New profile created successfully');
          console.log('Inserted data:', insertData);
        }
      }
      
      // Update profile data with picture
      const updatedProfile = {
        ...profile,
        ...profileData,
        profile_picture: imageData
      };

      // Also save to mobile storage as backup
      try {
        if (Platform.OS !== 'web') {
          await Storage.setItem('userProfile', JSON.stringify(updatedProfile));
          console.log('Profile picture also backed up to mobile storage');
        } else if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && window.localStorage) {
          localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
          console.log('Profile picture also backed up to localStorage');
        }
      } catch (storageError) {
        console.warn('Failed to backup to local storage:', storageError);
        // Don't fail the whole operation for storage backup issues
      }

      // Update local state
      console.log('Updating local state with new profile picture');
      setProfile(updatedProfile);
      setProfilePicture(imageData);
      console.log('Local state updated successfully');
      console.log('=== SAVE PROFILE PICTURE DEBUG END - SUCCESS ===');
      
      Alert.alert('Success', 'Profile picture updated successfully!');
      return true;
      
    } catch (err) {
      console.error('=== SAVE PROFILE PICTURE DEBUG END - ERROR ===');
      console.error('Error saving profile picture:', err);
      console.error('Error stack:', err.stack);
      Alert.alert('Error', `Failed to save profile picture: ${err.message}`);
      return false;
    }
  };

  // Remove profile picture
  const removeProfilePicture = async () => {
    console.log('🗑️ Remove profile picture button pressed');
    
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Starting profile picture removal...');
              
              // Clear profile picture from local state immediately
              setProfilePicture(null);
              
              // Safely update profile data without picture
              const currentProfile = profile || {};
              const updatedProfile = {
                ...currentProfile,
                profile_picture: null,
                updated_at: new Date().toISOString()
              };
              
              // Update profile state immediately
              setProfile(updatedProfile);

              // Clear from localStorage/AsyncStorage with proper platform guards
              try {
                if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && window.localStorage) {
                  // Safely get user email
                  const userEmail = user?.email || email;
                  if (userEmail) {
                    // Remove the specific profile picture entry
                    localStorage.removeItem(`profilePicture_${userEmail}`);
                    
                    // Update the main profile data
                    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
                    
                    // Also clear any cached profile data
                    try {
                      const keys = Object.keys(localStorage);
                      keys.forEach(key => {
                        if (key.includes('profile') && key.includes(userEmail)) {
                          localStorage.removeItem(key);
                        }
                      });
                    } catch (keyError) {
                      console.warn('Error clearing localStorage keys:', keyError);
                    }
                    
                    console.log('✅ Cleared profile picture from localStorage');
                  }
                } else if (Platform.OS !== 'web') {
                  // Use AsyncStorage for mobile
                  const userEmail = user?.email || email;
                  if (userEmail) {
                    await Storage.removeItem(`profilePicture_${userEmail}`);
                    await Storage.setItem('userProfile', JSON.stringify(updatedProfile));
                    console.log('✅ Cleared profile picture from mobile storage');
                  }
                }
              } catch (storageError) {
                console.warn('Storage clear error:', storageError);
              }

              // Try to save to Supabase
              const userEmail = user?.email || email;
              if (userEmail) {
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      profile_picture: null,
                      updated_at: new Date().toISOString()
                    })
                    .eq('email', userEmail);

                  if (error) {
                    console.warn('Failed to remove profile picture from Supabase:', error);
                  } else {
                    console.log('✅ Profile picture removed from Supabase');
                  }
                } catch (supabaseError) {
                  console.warn('Supabase update error:', supabaseError);
                }
              }

              // Force a complete refresh of profile data
              try {
                await fetchProfile();
              } catch (fetchError) {
                console.warn('Error refreshing profile:', fetchError);
              }
              
              Alert.alert('Success', 'Profile picture removed successfully');
              console.log('✅ Profile picture removal completed');
            } catch (err) {
              console.error('Error removing profile picture:', err);
              Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Start editing profile
  const startEditing = () => {
    setEditFormData({
      name: profile.name || '',
      gender: profile.gender || ''
    });
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditFormData({
      name: profile.name || '',
      gender: profile.gender || ''
    });
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'User email not found');
      return;
    }

    // Validate form data
    if (!editFormData.name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    try {
      console.log('Saving profile changes:', {
        email: user.email,
        name: editFormData.name,
        gender: editFormData.gender
      });

      const updatedProfile = {
        ...profile,
        email: user.email,
        name: editFormData.name.trim(),
        gender: editFormData.gender.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      };

      // Save to localStorage first
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      }

      // Try to save to Supabase with proper upsert handling
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          email: user.email,
          name: editFormData.name.trim(),
          gender: editFormData.gender.toLowerCase().trim(),
          profile_picture: profile.profile_picture || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        Alert.alert('Warning', 'Profile saved locally but failed to sync to server. Error: ' + error.message);
      } else {
        console.log('Profile saved successfully to Supabase:', data);
        Alert.alert('Success', 'Profile updated successfully');
        // Update with the data returned from Supabase
        if (data && data[0]) {
          setProfile(data[0]);
        }
      }

      // Update local state with our changes
      setProfile(updatedProfile);
      setFormData({
        name: editFormData.name,
        gender: editFormData.gender
      });
      setIsEditing(false);
      
    } catch (err) {
      console.error('Save profile error:', err);
      Alert.alert('Error', 'Failed to update profile: ' + err.message);
    }
  };

  // Debug logging
  console.log('ProfileScreen Debug:', {
    user,
    params,
    email,
    userLoading
  });

  // Define fetchProfile function that can be reused
  const fetchProfile = async () => {
    if (!email) {
      console.log('No email available for profile fetch');
      setLoading(false);
      return;
    }

    console.log('Fetching profile for email:', email);

    try {
      // First try to load from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (!error && data) {
        // Supabase data found
        console.log('Profile data fetched from Supabase:', data);
        setProfile(data);
      } else {
        // Supabase failed, try localStorage backup
        console.warn('Supabase profile fetch failed, trying localStorage:', error);
        
        let profileData = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const savedProfile = localStorage.getItem('userProfile');
          if (savedProfile) {
            try {
              profileData = JSON.parse(savedProfile);
              console.log('Profile data loaded from localStorage:', profileData);
            } catch (parseErr) {
              console.error('Error parsing localStorage profile:', parseErr);
            }
          }
        }

        if (profileData) {
          // Check if email matches or if we should use the data anyway
          if (profileData.email === email || !profileData.email) {
            console.log('Using localStorage profile data:', profileData);
            setProfile(profileData);
          } else {
            console.log('Email mismatch in localStorage. Expected:', email, 'Found:', profileData.email);
            setProfile({});
          }
        } else {
          console.log('No profile data found in localStorage for email:', email);
          setProfile({});
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Try localStorage as final fallback
      let profileData = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          try {
            profileData = JSON.parse(savedProfile);
            console.log('Profile data loaded from localStorage (fallback):', profileData);
          } catch (parseErr) {
            console.error('Error parsing localStorage profile:', parseErr);
          }
        }
      }

      if (profileData) {
        // Check if email matches or if we should use the data anyway
        if (profileData.email === email || !profileData.email) {
          console.log('Using localStorage profile data (fallback):', profileData);
          setProfile(profileData);
        } else {
          console.log('Email mismatch in localStorage (fallback). Expected:', email, 'Found:', profileData.email);
          setProfile({});
        }
      } else {
        console.log('No profile data found anywhere for email:', email);
        setProfile({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [email]);

  const formatGender = (gender) => {
    switch (gender) {
      case 'male':
        return 'Male';
      case 'female':
        return 'Female';
      case 'prefer_not_to_say':
        return 'Prefer not to say';
      default:
        return gender;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      
      // Navigate to login page using Expo Router
      setTimeout(() => {
        router.replace('/loginScreen');
      }, 100);
      
    } catch (error) {
      console.error('Error during logout:', error);
      // Still navigate to login even if there's an error
      router.replace('/loginScreen');
    }
  };

  const handleSettingsPress = () => {
    router.push('/settingsScreen');
  };

  if (userLoading) {
    return (
      <View style={[styles.bg, darkMode && styles.bgDark]}>
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Profile</Text>
          <Text style={[styles.email, darkMode && styles.textDark]}>Loading user session...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bg, darkMode && styles.bgDark]}>
      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.title, darkMode && styles.titleDark]}>Profile</Text>
        {loading ? (
          <Text style={[styles.email, darkMode && styles.textDark]}>Loading profile data...</Text>
        ) : (
          <>
            {/* Profile Picture Section */}
            <View style={styles.profilePictureContainer}>
              {getProfilePicture() ? (
                <TouchableOpacity onPress={isCurrentUser ? handleProfilePictureUpload : null}>
                  <Image 
                    source={{ uri: getProfilePicture() }} 
                    style={styles.profilePicture}
                    onError={() => {
                      console.log('Failed to load profile picture');
                      setProfilePicture(null);
                    }}
                  />
                  {isCurrentUser && (
                    <View style={styles.profilePictureOverlay}>
                      <Text style={styles.profilePictureOverlayText}>Change</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.profilePicturePlaceholder}
                  onPress={isCurrentUser ? handleProfilePictureUpload : null}
                >
                  <Text style={styles.profilePicturePlaceholderText}>
                    {isCurrentUser ? '+ Add Photo' : 'No Photo'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Profile Picture Actions */}
              {isCurrentUser && getProfilePicture() && (
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={removeProfilePicture}
                >
                  <Text style={styles.removePhotoText}>Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.email, darkMode && styles.textDark]}>
              {getProfileName()}
            </Text>
            <Text style={[styles.info, darkMode && styles.textDark]}>Email: {email || 'No email available'}</Text>
            
            {/* Profile Information - Edit Mode or Display Mode */}
            {isEditing && isCurrentUser ? (
              <View style={[styles.editContainer, darkMode && styles.editContainerDark]}>
                <Text style={[styles.editTitle, darkMode && styles.editTitleDark]}>Edit Profile</Text>
                <TextInput
                  placeholder="Full Name"
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({...editFormData, name: text})}
                  style={[styles.editInput, darkMode && styles.editInputDark]}
                  placeholderTextColor={darkMode ? '#888' : '#666'}
                />
                <TextInput
                  placeholder="Gender (male/female/prefer_not_to_say)"
                  value={editFormData.gender}
                  onChangeText={(text) => setEditFormData({...editFormData, gender: text})}
                  style={[styles.editInput, darkMode && styles.editInputDark]}
                  placeholderTextColor={darkMode ? '#888' : '#666'}
                />
                <View style={styles.editButtonRow}>
                  <TouchableOpacity style={styles.saveButton} onPress={saveProfileChanges}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfoContainer}>
                {profile.name && <Text style={[styles.info, darkMode && styles.textDark]}>Name: {profile.name}</Text>}
                {profile.gender && <Text style={[styles.info, darkMode && styles.textDark]}>Gender: {formatGender(profile.gender)}</Text>}
                {profile.created_at && (
                  <Text style={[styles.info, darkMode && styles.textDark]}>
                    Member since: {new Date(profile.created_at).toLocaleDateString()}
                  </Text>
                )}
                {isCurrentUser && (
                  <TouchableOpacity style={styles.editProfileButton} onPress={startEditing}>
                    <Text style={styles.editProfileButtonText}>✏️ Edit Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
        {isCurrentUser && <Button title="Settings" onPress={handleSettingsPress} color="#4F8EF7" />}
        {isCurrentUser && <Button title="Logout" onPress={handleLogout} color="#E57373" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    minWidth: 300,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    color: '#555',
    marginBottom: 24,
  },
  info: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4F8EF7',
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicturePlaceholderText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  profilePictureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    paddingVertical: 8,
    alignItems: 'center',
  },
  profilePictureOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  removePhotoButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E57373',
    borderRadius: 15,
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  profileInfoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  editContainer: {
    width: '100%',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
  },
  editButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.45,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#E57373',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.45,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  editProfileButton: {
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editProfileButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  // Dark mode styles
  bgDark: {
    backgroundColor: '#1a1a1a',
  },
  cardDark: {
    backgroundColor: '#2d2d2d',
  },
  titleDark: {
    color: '#fff',
  },
  textDark: {
    color: '#fff',
  },
  editContainerDark: {
    backgroundColor: '#3a3a3a',
    borderColor: '#555',
  },
  editTitleDark: {
    color: '#fff',
  },
  editInputDark: {
    backgroundColor: '#4a4a4a',
    borderColor: '#666',
    color: '#fff',
  },
});