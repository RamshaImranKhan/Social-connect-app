import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { supabase } from './firebaseConfig';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');


  const handleReset = async () => {
    if (email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:8081/updatePassword', // Change to your deployed URL in production
      });
      if (error) {
        alert(error.message);
      } else {
        alert('Password reset link sent to your email!');
        router.replace('/loginScreen');
      }
    } else {
      alert('Please enter your email');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Forgot Password</Text>
      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginBottom: 10, padding: 8 }}
      />
      <Button title="Reset Password" onPress={handleReset} />
    </View>
  );
} 