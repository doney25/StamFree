import { auth } from '@/config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const [, setLoading] = useState(true);

  useEffect(() => {
    const checkStorage = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        console.log('AsyncStorage Keys:', keys);
        const authKeys = keys.filter(k => k.includes('firebase'));
        if (authKeys.length > 0) {
          const val = await AsyncStorage.getItem(authKeys[0]);
          console.log('Found Firebase Auth Token in Storage:', !!val);
        } else {
          console.log('No Firebase keys found in AsyncStorage.');
        }
      } catch (e) {
        console.error('Failed to read AsyncStorage:', e);
      }
    };

    checkStorage();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth State Changed. User:', user ? user.uid : 'null');
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a73e8" />
    </View>
  );
}
