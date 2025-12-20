import { deleteLocalFile } from '@/services/audio';
import { Audio, AVPlaybackStatusSuccess } from 'expo-av';
import { useEffect, useRef, useState } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'stopped' | 'playing';

export function useAudioRecording() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup recording and sound
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const prepareAudio = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Audio recording permission denied');
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const startRecording = async () => {
    await prepareAudio();
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recording.setOnRecordingStatusUpdate((s) => {
      if (s.isRecording && typeof s.durationMillis === 'number') {
        setDurationMs(s.durationMillis);
      }
    });
    recordingRef.current = recording;
    setStatus('recording');
    setUri(null);
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return null;
    await recordingRef.current.stopAndUnloadAsync();
    const localUri = recordingRef.current.getURI();
    recordingRef.current = null;
    setStatus('stopped');
    setUri(localUri ?? null);
    return localUri ?? null;
  };

  const play = async () => {
    if (!uri) return;
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync({ uri });
    soundRef.current = sound;
    setStatus('playing');
    sound.setOnPlaybackStatusUpdate((s) => {
      const playback = s as AVPlaybackStatusSuccess;
      if (playback.didJustFinish) {
        setStatus('stopped');
      }
    });
    await sound.playAsync();
  };

  const reset = async () => {
    recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    soundRef.current?.unloadAsync().catch(() => undefined);
    // Privacy: delete local recording file
    await deleteLocalFile(uri);
    recordingRef.current = null;
    soundRef.current = null;
    setUri(null);
    setDurationMs(0);
    setStatus('idle');
  };

  return {
    status,
    uri,
    durationMs,
    startRecording,
    stopRecording,
    play,
    reset,
  };
}
