import { auth, db } from "@/config/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CreateAccountScreen() {
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [speechIssues, setSpeechIssues] = useState<Record<string, boolean>>({});

  const speechIssueOptions = useMemo(
    () => [
      "Stuttering",
      "Stammering",
      "Prolongation",
      "Blocks (silent pauses)",
      "Cluttering",
      "Word or syllable repetitions",
      "Sound substitutions/distortions",
      "Other (not listed)",
    ],
    []
  );

  const toggleSpeechIssue = (issue: string) => {
    setSpeechIssues((prev) => ({ ...prev, [issue]: !prev[issue] }));
  };

  const validateForm = () => {
    if (
      !childName ||
      !childAge ||
      !parentName ||
      !parentPhone ||
      !email ||
      !password
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return false;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return false;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(parentPhone.replace(/\D/g, ""))) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return false;
    }

    return true;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Update profile (display name)
      await updateProfile(user, { displayName: childName });

      // Store additional user data in Firestore
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firestore timeout")), 5000)
        );

        const selectedSpeechIssues = Object.entries(speechIssues)
          .filter(([, checked]) => checked)
          .map(([issue]) => issue);

        await Promise.race([
          setDoc(doc(db, "users", user.uid), {
            childName,
            childAge,
            parentName,
            parentPhone,
            email,
            speechIssues: selectedSpeechIssues,
            createdAt: new Date().toISOString(),
            gameProgress: {
              turtle: { tier: 1, level: "word" },
              snake: { tier: 1, level: "word" },
              balloon: { tier: 1, level: "word" },
              onetap: { tier: 1, level: "word" },
            },
          }),
          timeoutPromise,
        ]);
      } catch (firestoreError) {
        console.warn("Firestore save failed or timed out:", firestoreError);
      }

      // Store auth state locally (legacy/backup)
      await AsyncStorage.setItem(
        "authUser",
        JSON.stringify({ email, uid: user.uid })
      );

      // Send email verification
      try {
        await sendEmailVerification(user);
        console.log("Verification email sent");
      } catch (verifyError) {
        console.warn("Failed to send verification email:", verifyError);
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      let errorMessage = "Failed to create account. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already in use.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak.";
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessContinue = () => {
    setShowSuccessModal(false);
    router.replace("/(auth)/email-verification");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Register your child and parent details
          </Text>

          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Child Details</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Child&apos;s Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter child's full name"
                value={childName}
                onChangeText={setChildName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Child&apos;s Age *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter child's age"
                value={childAge}
                onChangeText={setChildAge}
                keyboardType="number-pad"
                editable={!loading}
              />
            </View>

            <Text style={styles.sectionTitle}>Parent Details</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Parent&apos;s Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter parent's full name"
                value={parentName}
                onChangeText={setParentName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Parent&apos;s Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit phone number"
                value={parentPhone}
                onChangeText={setParentPhone}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!loading}
              />
            </View>

            <Text style={styles.sectionTitle}>
              Speech Challenges (optional)
            </Text>
            <Text style={styles.helperText}>
              Select any identified patterns to tailor practice.
            </Text>
            <View style={styles.chipGrid}>
              {speechIssueOptions.map((issue) => {
                const checked = !!speechIssues[issue];
                return (
                  <TouchableOpacity
                    key={issue}
                    style={[styles.chip, checked && styles.chipChecked]}
                    onPress={() => toggleSpeechIssue(issue)}
                    disabled={loading}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                      ]}
                    >
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.chipText,
                        checked && styles.chipTextChecked,
                      ]}
                    >
                      {issue}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Create password (min 6 characters)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity disabled={loading}>
                  <Text style={styles.link}>Login</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={handleSuccessContinue}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>🎉</Text>
            </View>
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalMessage}>
              Your account has been created successfully. Please verify your
              email address to continue.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleSuccessContinue}
            >
              <Text style={styles.modalButtonText}>Verify Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a73e8",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    width: "100%",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8f9ff",
  },
  chipChecked: {
    borderColor: "#1a73e8",
    backgroundColor: "#e8f0fe",
  },
  chipText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "700",
  },
  chipTextChecked: {
    color: "#1a73e8",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    shadowColor: "#1a73e8",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  checkboxChecked: {
    borderColor: "#1a73e8",
    backgroundColor: "#1a73e8",
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  button: {
    backgroundColor: "#1a73e8",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  footerText: {
    color: "#666",
    fontSize: 14,
  },
  link: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E8F0FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 30,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a73e8",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    width: "100%",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
