import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { supabase } from './firebaseConfig';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSignup = async () => {
    if (email && password && name && gender) {
      setLoading(true);
      try {
        // Create the user account
        const { data, error } = await supabase.auth.signUp({ 
          email: email.trim(), 
          password: password 
        });
        
        if (error) {
          console.error('Auth signup error:', error);
          alert(`Signup failed: ${error.message}`);
          setLoading(false);
          return;
        }

        if (!data.user) {
          alert('Signup failed: No user data returned');
          setLoading(false);
          return;
        }

        // Create profile data
        const profile = { 
          user_id: data.user.id,
          email: email.trim(), 
          name: name.trim(), 
          gender: gender.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Try to save to Supabase database first (primary storage)
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([profile]);
            
          if (profileError) {
            console.error('Profile creation failed in Supabase:', profileError);
            alert(`Signup failed: ${profileError.message}`);
            setLoading(false);
            return;
          }
          
          console.log('Profile successfully saved to Supabase database:', profile);
          
          // Also save to localStorage as backup
          if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('userProfile', JSON.stringify(profile));
            console.log('Profile also backed up to localStorage');
          }
          
        } catch (profileErr) {
          console.error('Profile creation error in Supabase:', profileErr);
          alert(`Signup failed: ${profileErr.message}`);
          setLoading(false);
          return;
        }

        alert('Account created successfully! You can now login with your credentials.');
        
        router.push('/loginScreen');
        
      } catch (err) {
        console.error('Signup error:', err);
        const errorMessage = err && err.message ? err.message : 'Unknown error occurred';
        alert('Signup failed: ' + errorMessage);
      }
      setLoading(false);
    } else {
      alert('Please fill in all fields');
    }
  };

  return (
    <View style={styles.bg}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign Up</Text>
        <TextInput
          placeholder="Enter your full name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor="#999"
        />
        <TextInput
          placeholder="Enter your email address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
        <TextInput
          placeholder="Create a strong password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholderTextColor="#999"
        />
        
        {/* Gender Selector */}
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Gender:</Text>
          <TouchableOpacity 
            style={styles.genderSelector}
            onPress={() => {
              if (Platform.OS === 'web') {
                // For web, use a simple prompt
                const genders = ['male', 'female', 'prefer_not_to_say'];
                const choice = prompt('Select Gender:\n1. Male\n2. Female\n3. Prefer not to say\n\nEnter 1, 2, or 3:');
                if (choice === '1') setGender('male');
                else if (choice === '2') setGender('female');
                else if (choice === '3') setGender('prefer_not_to_say');
              } else {
                // For mobile, use Alert with buttons
                Alert.alert(
                  'Select Gender',
                  'Choose your gender:',
                  [
                    { text: 'Male', onPress: () => setGender('male') },
                    { text: 'Female', onPress: () => setGender('female') },
                    { text: 'Prefer not to say', onPress: () => setGender('prefer_not_to_say') },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }
            }}
          >
            <View style={styles.genderTextContainer}>
              <Text style={styles.genderText}>
                {gender ? (gender === 'prefer_not_to_say' ? 'Prefer not to say' : gender.charAt(0).toUpperCase() + gender.slice(1)) : 'Tap to select gender'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Button 
          title={loading ? 'Creating Account...' : 'Sign Up'} 
          onPress={handleSignup} 
          color="#4F8EF7"
          disabled={loading}
        />
        
        {/* Login link - platform specific navigation */}
        {Platform.OS === 'web' ? (
          <a href="/loginScreen" style={{ ...styles.link, textDecoration: 'none', display: 'block' }}>
            Already have an account? Login
          </a>
        ) : (
          <TouchableOpacity onPress={() => router.push('/loginScreen')}>
            <Text style={styles.link}>Already have an account? Login</Text>
          </TouchableOpacity>
        )}
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: 220,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#333',
    minHeight: 40,
  },
  pickerContainer: {
    width: 220,
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  genderSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 12,
    justifyContent: 'center',
    minHeight: 40,
  },
  genderTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genderText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  link: {
    marginTop: 20,
    color: '#4F8EF7',
    fontWeight: 'bold',
  },
});
