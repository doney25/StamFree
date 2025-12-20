import { createFormData, deleteLocalFile, uploadAudioWithTimeout } from '@/services/audio';
import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ---------------- CONFIGURATION ----------------
// REPLACE THIS WITH YOUR LAPTOP'S IP ADDRESS!
// Do not use 'localhost'. Use '192.168.x.x'
const BACKEND_URL = 'http://192.168.1.5:5000/analyze_audio';
const HEALTH_URL = 'http://192.168.1.5:5000/health';
// -----------------------------------------------

export default function Demo() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'ok' | 'down'>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastUri, setLastUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone access.');
      }
    })();
  }, []);

  async function pingBackend() {
    try {
      const res = await Promise.race([
        fetch(HEALTH_URL, { method: 'GET' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]) as Response;
      if (res && res.ok) {
        setBackendStatus('ok');
      } else {
        setBackendStatus('down');
      }
    } catch (e) {
      setBackendStatus('down');
    }
  }

  async function startRecording() {
    try {
      if (isRecording || uploading) return; // Guard during busy states
      setResult(null);
      setLastError(null);
      console.log('Starting recording..');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const created = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(created.recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording.');
    }
  }

  async function stopRecording() {
    try {
      console.log('Stopping recording..');
      setIsRecording(false);

      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Error', 'No recording URI found.');
        return;
      }

      console.log('Recording stored at', uri);
      setLastUri(uri);
      await uploadAudio(uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  }

  async function uploadAudio(uri: string) {
    setUploading(true);

    try {
      const formData = createFormData(uri);
      console.log('Uploading to:', BACKEND_URL);
      const res = await uploadAudioWithTimeout(BACKEND_URL, formData, 6000);
      if (!res.ok) {
        setLastError(res.error ?? 'Upload failed');
        Alert.alert('Error', res.error ?? 'Could not connect to server. Check your IP address!');
        return;
      }
      console.log('Server Response:', res.json);
      setResult(res.json);
      // Delete local file after successful upload to respect privacy
      await deleteLocalFile(uri);
      setLastUri(null);
      setLastError(null);
    } catch (error) {
      console.error(error);
      setLastError('Could not connect to server. Check your IP address!');
      Alert.alert('Error', 'Could not connect to server. Check your IP address!');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stutter Detection Demo</Text>

      <View style={styles.healthRow}>
        <TouchableOpacity style={styles.healthButton} onPress={pingBackend}>
          <Text style={styles.healthText}>Ping Server</Text>
        </TouchableOpacity>
        <View style={[styles.statusDot, backendStatus === 'ok' ? styles.statusOk : backendStatus === 'down' ? styles.statusDown : styles.statusUnknown]} />
        <Text style={styles.statusLabel}>
          {backendStatus === 'ok' ? 'Online' : backendStatus === 'down' ? 'Offline' : 'Unknown'}
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.recordButton, (isRecording || uploading) ? styles.recording : null]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={uploading}
        >
          <Text style={styles.btnText}>
            {isRecording ? 'STOP RECORDING' : 'TAP TO RECORD'}
          </Text>
        </TouchableOpacity>
      </View>

      {uploading && (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      )}

      {lastError && lastUri && (
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#EF4444', marginBottom: 8 }}>{lastError}</Text>
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: '#10B981' }]}
            onPress={() => uploadAudio(lastUri!)}
            disabled={uploading}
          >
            <Text style={styles.btnText}>Retry Upload</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Analysis Result</Text>

          <Text style={styles.mainResult}>
            {result.is_stutter ? '⚠️ STUTTER DETECTED' : '✅ FLUENT SPEECH'}
          </Text>

          {result.is_stutter && (
            <View>
              <Text style={styles.subResult}>Type: {result.type}</Text>
              <Text style={styles.subResult}>
                Confidence: {((result.type_confidence || 0) * 100).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  healthButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  healthText: {
    color: 'white',
    fontWeight: '600',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOk: { backgroundColor: '#10B981' },
  statusDown: { backgroundColor: '#EF4444' },
  statusUnknown: { backgroundColor: '#9CA3AF' },
  statusLabel: {
    color: '#374151',
    fontWeight: '500',
  },
  card: {
    width: '100%',
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    elevation: 5,
  },
  recording: {
    backgroundColor: '#F44336',
  },
  btnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultBox: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
  },
  resultTitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 10,
  },
  mainResult: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  subResult: {
    fontSize: 18,
    color: '#555',
  },
});
