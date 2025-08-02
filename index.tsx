import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleAnim = useRef(new Animated.Value(-100)).current;
  const buttonAnim1 = useRef(new Animated.Value(100)).current;
  const buttonAnim2 = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.stagger(200, [
        Animated.spring(buttonAnim1, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(buttonAnim2, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Pulse animation for buttons
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    
    setTimeout(() => pulseAnimation.start(), 2000);

    return () => pulseAnimation.stop();
  }, []);

  const handleButtonPress = (route: string) => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start(() => {
        router.push(route as any);
      });
    });
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      style={styles.bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Floating circles for background decoration */}
      <Animated.View style={[styles.circle1, { opacity: fadeAnim }]} />
      <Animated.View style={[styles.circle2, { opacity: fadeAnim }]} />
      <Animated.View style={[styles.circle3, { opacity: fadeAnim }]} />
      
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.title,
            {
              transform: [{ translateY: titleAnim }],
            },
          ]}
        >
          Welcome to Connectify
        </Animated.Text>
        
        <Text style={styles.subtitle}>
          Connect, Share, and Discover Amazing Moments
        </Text>
        
        <View style={styles.buttonContainer}>
          <Animated.View
            style={{
              transform: [
                { translateX: buttonAnim1 },
                { scale: pulseAnim }
              ],
            }}
          >
            <TouchableOpacity
              style={[styles.button, styles.loginButton]}
              onPress={() => handleButtonPress('/loginScreen')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>🚀 Login</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View
            style={{
              transform: [
                { translateX: buttonAnim2 },
                { scale: pulseAnim }
              ],
            }}
          >
            <TouchableOpacity
              style={[styles.button, styles.signupButton]}
              onPress={() => handleButtonPress('/signupScreen')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>✨ Sign Up</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        <Text style={styles.footerText}>
          Join thousands of users worldwide
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: height * 0.1,
    left: -50,
  },
  circle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: height * 0.7,
    right: -30,
  },
  circle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    top: height * 0.3,
    right: width * 0.1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    minWidth: 350,
    maxWidth: width * 0.9,
    backdropFilter: 'blur(10px)',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2d3748',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    borderRadius: 25,
    marginVertical: 8,
    width: 280,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButton: {
    // Gradient will be applied via LinearGradient component
  },
  signupButton: {
    // Gradient will be applied via LinearGradient component
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 10,
  },
}); 