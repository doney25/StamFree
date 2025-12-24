import { auth, db } from '@/config/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const avatarMap: Record<string, any> = {
  bear: require('@/assets/profilepictures/bear.png'),
  crab: require('@/assets/profilepictures/crab.png'),
  dog: require('@/assets/profilepictures/dog.png'),
  giraffe: require('@/assets/profilepictures/giraffe.png'),
  hippo: require('@/assets/profilepictures/hippo.png'),
  lion: require('@/assets/profilepictures/lion.png'),
  rabbit: require('@/assets/profilepictures/rabbit.png'),
  tiger: require('@/assets/profilepictures/tiger.png'),
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('authUser');
    } catch (e) {
      console.warn('Failed to clear storage or sign out', e);
    } finally {
      router.replace('/(auth)/login');
    }
  }, []);

  const handleDeleteAccount = useCallback(() => {
  Alert.alert(
    'Delete Account',
    'This will permanently delete your account and all data. This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const user = auth.currentUser;
            if (!user) return;

            // Delete Firestore user data
            await deleteDoc(doc(db, 'users', user.uid));

            // Delete Auth account
            await deleteUser(user);

            // Clear local storage
            await AsyncStorage.removeItem('authUser');

            // Redirect
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert(
              'Error',
              'Please login again and retry deleting your account.'
            );
          }
        },
      },
    ]
  );
}, []);

  useFocusEffect(
  React.useCallback(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);

        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }
      } catch (error) {
        console.warn('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [])
);


  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileIcon}>
          {profile?.avatarId && (
            <Image
              source={avatarMap[profile.avatarId]}
              style={{ width: 80, height: 80 }}
            />
          )}
        </View>
        <Text style={styles.profileName}>{profile?.childName}</Text>
        <Text style={styles.profileEmail}>Manage account settings</Text>
      </View>

      <View style={styles.settingsContainer}>
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Display Name</Text>
          <Text style={styles.settingValue}>{profile?.childName}</Text>
        </View>

        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Age</Text>
          <Text style={styles.settingValue}>{profile?.childAge} years</Text>
        </View>

        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Speech Focus</Text>
          <Text style={styles.settingValue}>
            {profile?.speechIssues?.join(', ') || 'Not specified'}
          </Text>
        </View>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/editprofile')}
        >
          <MaterialCommunityIcons name="pencil" size={20} color="#1a73e8" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
        >
          <MaterialCommunityIcons name="delete" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Account Settings</Text>
        <Text style={styles.infoText}>• Manage your profile information</Text>
        <Text style={styles.infoText}>• View and update speech focus areas</Text>
        <Text style={styles.infoText}>• Access parental controls</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  profileIcon: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  editButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
  },
  editButtonText: {
    color: '#1a73e8',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#0369A1',
    marginBottom: 6,
    lineHeight: 18,
  },
  deleteButton: {
  flexDirection: 'row',
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 10,
  backgroundColor: '#991B1B',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
},
deleteButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},
});
