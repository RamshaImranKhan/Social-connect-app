import React, { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { supabase } from './firebaseConfig';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      alert('Password updated successfully!');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Set New Password</Text>
      <TextInput
        placeholder="Enter new password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, marginBottom: 10, padding: 8 }}
      />
      <Button title={loading ? 'Updating...' : 'Update Password'} onPress={handleUpdatePassword} disabled={loading} />
    </View>
  );
} 