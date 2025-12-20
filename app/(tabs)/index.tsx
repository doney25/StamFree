import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ExerciseTile {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const exercises: ExerciseTile[] = [
  {
    id: 'speech-practice',
    title: 'Speech Practice',
    description: 'Practice sentences with target phonemes',
    icon: 'microphone',
    color: '#FF6B6B',
    route: '/exercises/speech-practice',
  },
  {
    id: 'breathing',
    title: 'Breathing Exercises',
    description: 'Learn controlled breathing techniques',
    icon: 'lungs',
    color: '#4ECDC4',
    route: '/exercises/breathing-exercises',
  },
  {
    id: 'word-games',
    title: 'Word Games',
    description: 'Fun word puzzles and games',
    icon: 'cards-variant',
    color: '#FFD93D',
    route: '/exercises/word-games',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleExercisePress = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome Back! 👋</Text>
        <Text style={styles.subtitle}>Choose an exercise to get started</Text>
        <TouchableOpacity style={styles.demoLink} onPress={() => router.push('/demo')}>
          <MaterialCommunityIcons name="flask" size={18} color="#10B981" />
          <Text style={styles.demoText}>Open Stutter Detection Demo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.tilesContainer}>
          {exercises.map((exercise) => (
            <TouchableOpacity
              key={exercise.id}
              style={styles.tile}
              onPress={() => handleExercisePress(exercise.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: exercise.color }]}>
                <MaterialCommunityIcons
                  name={exercise.icon as any}
                  size={40}
                  color="#fff"
                />
              </View>
              <Text style={styles.tileTitle}>{exercise.title}</Text>
              <Text style={styles.tileDescription}>{exercise.description}</Text>
              <View style={styles.tileArrow}>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color={exercise.color}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons
              name="calendar-today"
              size={24}
              color="#1a73e8"
            />
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Sessions This Week</Text>
              <Text style={styles.statValue}>12</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons
              name="star"
              size={24}
              color="#FFD93D"
            />
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Current Streak</Text>
              <Text style={styles.statValue}>5 days</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a73e8',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  demoLink: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoText: {
    color: '#10B981',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  tilesContainer: {
    gap: 16,
    marginBottom: 32,
  },
  tile: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  tileDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  tileArrow: {
    alignItems: 'flex-end',
  },
  statsContainer: {
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statContent: {
    marginLeft: 16,
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
});