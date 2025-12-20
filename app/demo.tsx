import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ---------------- CONFIGURATION ----------------
// REPLACE WITH YOUR LAPTOP IP
const BACKEND_URL = 'http://10.12.26.246:5000/analyze_audio'; 
const HEALTH_URL = 'http://10.12.26.246:5000/health'; // Ensure port matches
// -----------------------------------------------

export default function Demo() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'ok' | 'down'>('unknown');

  // 1. Permissions & Health Check on Mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone access.');
      }
    })();
    pingBackend();
  }, []);

  // Health Check
  async function pingBackend() {
    setBackendStatus('unknown');
    try {
      // Create a timeout promise
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const fetchRequest = fetch(HEALTH_URL, { method: 'GET' });
      
      // We expect a 404 is fine (means server is reachable), 
      // but ideally your flask app has a simple '/' route.
      // If fetch works, server is UP.
      await Promise.race([fetchRequest, timeout]);
      setBackendStatus('ok');
    } catch (e) {
      console.log("Backend check failed:", e);
      setBackendStatus('down');
    }
  }

  // 2. Start Recording
  async function startRecording() {
    try {
      setResult(null);
      console.log('Starting recording..');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording.');
    }
  }

  // 3. Stop & Upload
  async function stopRecording() {
    setIsRecording(false);
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) uploadAudio(uri);
  }

  // 4. Upload Logic
  async function uploadAudio(uri: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      const fileType = uri.split('.').pop() || 'm4a';
      
      formData.append('file', {
        uri,
        name: `recording.${fileType}`,
        type: `audio/${fileType}`,
      } as any);

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();
      console.log('Server Response:', data);
      setResult(data);
    } catch (error) {
      Alert.alert('Error', 'Check Server IP & Connectivity');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Stutter Detection</Text>

      {/* STATUS INDICATOR */}
      <TouchableOpacity onPress={pingBackend} style={styles.statusContainer}>
        <View style={[styles.statusDot, 
          backendStatus === 'ok' ? styles.statusOk : 
          backendStatus === 'down' ? styles.statusDown : styles.statusUnknown
        ]} />
        <Text style={styles.statusText}>
          Server: {backendStatus === 'ok' ? "Connected" : backendStatus === 'down' ? "Unreachable" : "Checking..."}
        </Text>
      </TouchableOpacity>

      {/* RECORD BUTTON */}
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording ? styles.recording : null]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.btnText}>
            {isRecording ? 'STOP RECORDING' : 'TAP TO RECORD'}
          </Text>
        </TouchableOpacity>
      </View>

      {uploading && <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 20 }} />}

      {/* RESULTS SECTION */}
      {result && (
        <View style={styles.resultBox}>
          
          {/* 1. MAIN RESULT */}
          <Text style={styles.resultHeader}>Analysis Result</Text>
          <Text style={[styles.mainResult, result.is_stutter ? styles.textRed : styles.textGreen]}>
            {result.is_stutter ? '⚠️ STUTTER DETECTED' : '✅ FLUENT SPEECH'}
          </Text>

          {/* 2. TRANSCRIPT (New) */}
          <View style={styles.divider} />
          <Text style={styles.label}>Transcript:</Text>
          <Text style={styles.transcriptText}>
            "{result.transcript || "No speech detected"}"
          </Text>

          {/* 3. DETAILS (If Stutter) */}
          {result.is_stutter && (
            <View style={styles.detailContainer}>
              
              {/* PHONEME BADGE (New) */}
              {result.problem_phoneme && (
                <View style={styles.phonemeBox}>
                  <Text style={styles.phonemeLabel}>Trouble Sound</Text>
                  <Text style={styles.phonemeMain}>/{result.problem_phoneme}/</Text>
                </View>
              )}

              {/* SCORES */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Type</Text>
                  <Text style={styles.statValue}>{result.type}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Confidence</Text>
                  <Text style={styles.statValue}>{((result.type_confidence || 0) * 100).toFixed(0)}%</Text>
                </View>
              </View>

              <Text style={styles.debugText}>
                Detection Score: {result.stutter_score}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F2F2F7', // iOS System Gray
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  // Status Styles
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOk: { backgroundColor: '#34C759' },
  statusDown: { backgroundColor: '#FF3B30' },
  statusUnknown: { backgroundColor: '#8E8E93' },
  statusText: { fontSize: 14, color: '#666' },

  // Card & Button
  card: { width: '100%', alignItems: 'center', marginBottom: 20 },
  recordButton: {
    backgroundColor: '#007AFF',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#007AFF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  recording: { backgroundColor: '#FF3B30', shadowColor: '#FF3B30' },
  btnText: { color: 'white', fontSize: 18, fontWeight: '700', letterSpacing: 1 },

  // Results
  resultBox: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  resultHeader: { fontSize: 14, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 8 },
  mainResult: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  textRed: { color: '#FF3B30' },
  textGreen: { color: '#34C759' },
  
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 15 },
  
  label: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  transcriptText: { fontSize: 18, color: '#3A3A3C', fontStyle: 'italic', lineHeight: 24 },

  // Detail View
  detailContainer: { marginTop: 10 },
  phonemeBox: {
    backgroundColor: '#FFECEB',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  phonemeLabel: { color: '#FF3B30', fontWeight: '600', marginBottom: 4 },
  phonemeMain: { fontSize: 32, fontWeight: '800', color: '#FF3B30' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statCol: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 14, color: '#8E8E93' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  
  debugText: { fontSize: 12, color: '#C7C7CC', textAlign: 'center', marginTop: 10 },
});