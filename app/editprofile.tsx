import { auth, db } from '@/config/firebaseConfig';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const profileAvatars = [
  { id: 'bear', image: require('@/assets/profilepictures/bear.png') },
  { id: 'crab', image: require('@/assets/profilepictures/crab.png') },
  { id: 'dog', image: require('@/assets/profilepictures/dog.png') },
  { id: 'giraffe', image: require('@/assets/profilepictures/giraffe.png') },
  { id: 'hippo', image: require('@/assets/profilepictures/hippo.png') },
  { id: 'lion', image: require('@/assets/profilepictures/lion.png') },
  { id: 'rabbit', image: require('@/assets/profilepictures/rabbit.png') },
  { id: 'tiger', image: require('@/assets/profilepictures/tiger.png') },
];

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [speechIssues, setSpeechIssues] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const speechOptions = ['Prolongation', 'Blocks', 'Repetitions'];

  // 🔹 Fetch existing data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          setChildName(data.childName || '');
          setChildAge(String(data.childAge || ''));
          setSpeechIssues(data.speechIssues || []);
          setSelectedAvatar(data.avatarId || null);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // 🔹 Save updated data
  const handleSave = async () => {
    if (!childName || !childAge) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        childName,
        childAge: Number(childAge),
        speechIssues,
        avatarId: selectedAvatar,
      });

      Alert.alert('Success', 'Profile updated successfully');
      router.replace('/(tabs)/profile');
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Child Name</Text>
      <TextInput
        style={styles.input}
        value={childName}
        onChangeText={setChildName}
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        value={childAge}
        onChangeText={setChildAge}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Choose Avatar</Text>
      <View style={styles.avatarRow}>
        {profileAvatars.map((avatar) => (
          <TouchableOpacity
            key={avatar.id}
            style={[
                styles.avatarBox,
                selectedAvatar === avatar.id && styles.avatarSelected,
            ]}
            onPress={() => setSelectedAvatar(avatar.id)}
          >
            <Image source={avatar.image} style={styles.avatarImage} />
        </TouchableOpacity>
       ))}
      </View>

      <Text style={styles.label}>Speech Challenges</Text>
      {speechOptions.map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.chip,
            speechIssues.includes(item) && styles.chipSelected,
          ]}
          onPress={() =>
            setSpeechIssues((prev) =>
              prev.includes(item)
                ? prev.filter((i) => i !== item)
                : [...prev, item]
            )
          }
        >
          <Text
            style={{
                color: speechIssues.includes(item) ? '#1a73e8' : '#111827',
                fontWeight: '500',
            }}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Save Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  padding: 20,
  backgroundColor: '#F8F9FA',
  minHeight: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
  fontSize: 14,
  fontWeight: '600',
  color: '#374151',
  marginTop: 18,
  },
  input: {
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 10,
  padding: 14,
  marginTop: 6,
  backgroundColor: '#fff',
  color: '#111827',
  fontSize: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  avatarBox: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 6,
  },
  avatarSelected: {
    borderColor: '#1a73e8',
  },
  avatarImage: {
    width: 50,
    height: 50,
  },
  chip: {
  padding: 10,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#ccc',
  marginTop: 8,
  marginRight: 8,   // 👈 add this
  },
  chipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1a73e8',
  },
  saveButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});


