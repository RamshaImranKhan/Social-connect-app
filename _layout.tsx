import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';
import { UserProvider, useUser } from './UserContext';

function AppStack() {
  const { user } = useUser();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="homeScreen" options={{ headerShown: false }} />
          <Stack.Screen name="profileScreen" options={{ headerShown: false }} />
          <Stack.Screen name="settingsScreen" options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="loginScreen" options={{ headerShown: false }} />
          <Stack.Screen name="signupScreen" options={{ headerShown: false }} />
          <Stack.Screen name="forgotPassword" options={{ headerShown: false }} />
        </>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppStack />
        <StatusBar style="auto" />
      </ThemeProvider>
    </UserProvider>
  );
}
