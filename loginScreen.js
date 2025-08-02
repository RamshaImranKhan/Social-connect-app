import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useUser } from './UserContext';
import { supabase } from './firebaseConfig';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { setUser } = useUser();
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async () => {
    if (email && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password: password 
        });
        
        if (error) {
          console.error('Login error:', error);
          alert(`Login failed: ${error.message}`);
        } else if (data.user) {
          setUser({ 
            email: data.user.email, 
            id: data.user.id 
          });
          alert('Login successful!');
          console.log('Login successful, navigating to home');
          // Navigate to homeScreen after successful login
          router.replace('/homeScreen');
        }
      } catch (err) {
        console.error('Unexpected login error:', err);
        alert('Login failed. Please try again.');
      }
    } else {
      alert('Please enter email and password');
    }
  };

  const handleForgotPassword = async () => {
    if (resetEmail) {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'http://localhost:8081/updatePassword',
      });
      if (error) {
        alert(error.message);
      } else {
        alert('Password reset link sent to your email!');
        setShowForgot(false);
        setResetEmail('');
      }
    } else {
      alert('Please enter your email');
    }
  };

  return (
    <View style={styles.bg}>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        <Button title="Login" onPress={handleLogin} color="#4F8EF7" />
        {/* Sign up link - platform specific navigation */}
        {Platform.OS === 'web' ? (
          <a href="/signupScreen" style={{ ...styles.link, textDecoration: 'none', display: 'block' }}>
            Don't have an account? Sign up
          </a>
        ) : (
          <TouchableOpacity onPress={() => router.push('/signupScreen')}>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </TouchableOpacity>
        )}
        {/* Forgot Password functionality inline */}
        {!showForgot ? (
          <TouchableOpacity onPress={() => setShowForgot(true)}>
            <Text style={styles.link}>Forgot Password?</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <TextInput
              placeholder="Enter your email"
              value={resetEmail}
              onChangeText={setResetEmail}
              style={styles.input}
            />
            <Button title="Send Reset Link" onPress={handleForgotPassword} color="#4F8EF7" />
            <TouchableOpacity onPress={() => setShowForgot(false)}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
    padding: 10,
    marginBottom: 12,
    width: 220,
    backgroundColor: '#f9f9f9',
  },
  link: {
    marginTop: 16,
    color: '#4F8EF7',
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 