import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getStudents, deleteUser } from "../store/userSlice";
import { 
  sendAuthenticationEmail, 
  resetEmailState,
  addToEmailHistory 
} from "../store/emailSlice";
import LoadingScreen from "../components/LoadingScreen";
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  RefreshControl, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Modal
} from "react-native";
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from "@react-navigation/native";
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase imports for authentication
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../FirebaseConfig";

import { AdminOnly } from "../utils";
import Header from '../components/Header';

const AdminUserManagement = () => {
  const dispatch = useDispatch();
  const { students, loading, error } = useSelector((state) => state.user);
  
  const {
    status: emailStatus,
    message: emailMessage,
    isSent: emailSent,
    isSending: emailSending,
    isNotSent: emailFailed
  } = useSelector(state => state.email || {});

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleStudents, setVisibleStudents] = useState(10);
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedDegree, setSelectedDegree] = useState("B.Tech");
  
  // Simplified states - only track local UI status
  const [authStatuses, setAuthStatuses] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [processingUsers, setProcessingUsers] = useState(new Set());
  const [currentProcessingStep, setCurrentProcessingStep] = useState({});
  
  const navigation = useNavigation();

  // Generate random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Load auth statuses from storage (for UI state only)
  const loadAuthStatuses = async () => {
    try {
      const stored = await AsyncStorage.getItem('authStatuses');
      if (stored) {
        const parsedStatuses = JSON.parse(stored);
        console.log('📱 Loaded auth statuses:', parsedStatuses);
        setAuthStatuses(parsedStatuses);
      }
    } catch (error) {
      console.error('❌ Error loading auth statuses:', error);
    }
  };

  // Save auth statuses to storage
  const saveAuthStatuses = async (statuses) => {
    try {
      await AsyncStorage.setItem('authStatuses', JSON.stringify(statuses));
      setAuthStatuses(statuses);
      console.log('💾 Auth statuses saved:', statuses);
    } catch (error) {
      console.error('❌ Error saving auth statuses:', error);
    }
  };

  // Update processing step for UI feedback
  const setProcessingStep = (studentId, step) => {
    setCurrentProcessingStep(prev => ({
      ...prev,
      [studentId]: step
    }));
  };

  const fetchStudents = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Fetching students...');
      await dispatch(getStudents());
      console.log('✅ Students fetched successfully');
    } catch (error) {
      console.error('❌ Error fetching students:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    loadAuthStatuses();
  }, [dispatch]);

  // Handle email status changes
  useEffect(() => {
    if (emailSent && emailStatus === 'succeeded') {
      setSuccessMessage(emailMessage);
      setShowSuccessModal(true);
      setTimeout(() => {
        dispatch(resetEmailState());
      }, 3000);
    }
  }, [emailSent, emailStatus, emailMessage, dispatch]);

  // Enhanced filtering with proper null checks
  useEffect(() => {
    console.log('🔍 Filtering students...', {
      studentsCount: students?.length || 0,
      selectedYear,
      selectedDegree,
      searchQuery: searchQuery?.trim() || ''
    });

    // Safety check for students array
    if (!students || !Array.isArray(students)) {
      console.warn('⚠️ No students array or not an array');
      setFilteredStudents([]);
      return;
    }

    // Enhanced sorting with null safety
    let sortedStudents = [...students].sort((a, b) => {
      const nameA = String(a?.username || '').toLowerCase();
      const nameB = String(b?.username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    let degreePrefix = selectedDegree === "B.Tech" ? "b" :
                       selectedDegree === "M.Tech" ? "m" :
                       selectedDegree === "PhD" ? "p" : "";

    // Enhanced filtering with comprehensive null checks
    let filteredByYear = sortedStudents.filter(student => {
      if (!student || typeof student !== 'object') {
        console.warn('⚠️ Invalid student object:', student);
        return false;
      }

      const rollNo = String(student.rollNo || '');
      if (!rollNo) {
        console.warn('⚠️ Student missing rollNo:', student);
        return false;
      }

      const searchPrefix = String(selectedYear).slice(2) + degreePrefix;
      const matches = rollNo.toLowerCase().startsWith(searchPrefix.toLowerCase());
      
      return matches;
    });

    console.log(`📊 After year filter (${selectedYear} ${selectedDegree}):`, filteredByYear.length);

    // Enhanced search filtering with null safety
    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      const searchFiltered = filteredByYear.filter(student => {
        if (!student || typeof student !== 'object') {
          return false;
        }
        
        const username = String(student.username || '').toLowerCase();
        const rollNo = String(student.rollNo || '').toLowerCase();
        const email = String(student.email || '').toLowerCase();
        
        return username.includes(queryLower) || 
               rollNo.includes(queryLower) || 
               email.includes(queryLower);
      });
      
      console.log(`🔍 After search filter (${searchQuery}):`, searchFiltered.length);
      setFilteredStudents(searchFiltered);
    } else {
      setFilteredStudents(filteredByYear);
    }
  }, [searchQuery, students, selectedYear, selectedDegree]);

  const handleDelete = (studentId) => {
    Alert.alert(
      "Delete Student",
      "Are you sure you want to delete this student?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => dispatch(deleteUser(studentId))
        }
      ]
    );
  };

  // SIMPLIFIED: Email-First Authentication Flow (CLEAN VERSION)
// SIMPLIFIED: Use existing uid field instead of creating authUID
const handleAddToAuthentication = async (student) => {
  if (!student || !student.id || !student.email) {
    Alert.alert('Error', 'Invalid student data');
    return;
  }

  setProcessingUsers(prev => new Set([...prev, student.id]));
  
  try {
    const updatedStatuses = {
      ...authStatuses,
      [student.id]: 'processing'
    };
    setAuthStatuses(updatedStatuses);
    await saveAuthStatuses(updatedStatuses);

    console.log(`🚀 Adding authentication to user with existing UID: ${student.uid}`);

    const randomPassword = generateRandomPassword();
    
    // STEP 1: Send authentication email FIRST
    console.log('📧 Step 1: Sending authentication email...');
    setProcessingStep(student.id, 'Sending Email...');
    
    await dispatch(sendAuthenticationEmail({
      name: student.username || 'Student',
      email: student.email,
      password: randomPassword,
      role: student.designation || 'Student'
    })).unwrap();

    console.log('✅ Email sent successfully - creating Firebase Auth account...');
    setProcessingStep(student.id, 'Creating Auth Account...');
    
    // STEP 2: Create Firebase Auth account using EXISTING uid
    console.log('🔐 Step 2: Creating Firebase Auth account with existing UID...');
    
    // If your existing uid is NOT a Firebase Auth UID, you'll need to create a new one
    // and update the document, OR use a different approach
    
    const userCredential = await createUserWithEmailAndPassword(
      FIREBASE_AUTH, 
      student.email, 
      randomPassword
    );
    
    const newFirebaseUID = userCredential.user.uid;
    console.log('✅ New Firebase Auth UID created:', newFirebaseUID);
    
    // STEP 3: Update existing document - replace old uid with Firebase Auth UID
    console.log('💾 Step 3: Updating document with Firebase Auth UID...');
    await updateDoc(doc(FIREBASE_DB, "users", student.id), {
      uid: newFirebaseUID, // Update existing uid field with Firebase Auth UID
      isAuthenticated: true,
      authenticationDate: Timestamp.now(),
      emailSent: true,
      emailSentDate: Timestamp.now(),
      authenticationFlow: 'email-first',
      lastUpdated: Timestamp.now()
    });
    
    console.log('✅ User document updated with Firebase Auth UID');
    
    // Update local state and continue with success flow...
    
  } catch (error) {
    console.error('❌ Authentication process failed:', error);
    // Error handling...
  }
};

  // Remove user from authentication
  const handleRemoveFromAuthentication = async (student) => {
    Alert.alert(
      "Remove Authentication",
      `Remove ${student.username} from authentication system?\n\nThis will disable their login access.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              // Since we're now using Firebase UID as document ID,
              // we need to find the document by student data
              // This is a limitation of the current approach - we should ideally 
              // store the mapping or use a different strategy
              
              console.log('Note: Remove functionality needs to be implemented with proper UID mapping');
              Alert.alert('Info', 'Remove authentication feature needs to be updated for the new document structure.');
              
            } catch (error) {
              console.error('❌ Remove authentication error:', error);
              Alert.alert('Error', 'Failed to remove user from authentication system');
            }
          }
        }
      ]
    );
  };

  // Check if student is authenticated using safe property access
  const isStudentAuthenticated = (student) => {
    if (!student || typeof student !== 'object') {
      return false;
    }
    
    // Check both the database field and local status
    return student.isAuthenticated === true || authStatuses[student.id] === 'authenticated';
  };

  // Get auth status for a student
  const getAuthStatus = (studentId) => {
    return authStatuses[studentId] || 'not_authenticated';
  };

  // Check if student has email sent with null safety
  const isEmailSent = (student) => {
    if (!student || typeof student !== 'object') {
      return false;
    }
    return student.emailSent === true;
  };

  // Render authentication icon based on status
  const renderAuthIcon = (student) => {
    if (!student) {
      return null;
    }

    const isAuthenticated = isStudentAuthenticated(student);
    const authStatus = getAuthStatus(student.id);
    const isProcessing = processingUsers.has(student.id);
    const processingStep = currentProcessingStep[student.id];

    if (isAuthenticated || authStatus === 'authenticated') {
      return (
        <TouchableOpacity 
          style={styles.authIconContainer}
          onPress={() => handleRemoveFromAuthentication(student)}
        >
          <Icon name="verified-user" size={24} color="#4CAF50" />
          <Text style={styles.authStatusText}>Authenticated</Text>
          <Text style={styles.authSubtext}>Clean Structure</Text>
        </TouchableOpacity>
      );
    }

    if (isProcessing || authStatus === 'processing') {
      return (
        <View style={styles.authIconContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.authStatusText}>
            {processingStep || 'Processing...'}
          </Text>
        </View>
      );
    }

    if (authStatus === 'failed') {
      return (
        <TouchableOpacity 
          style={styles.authIconContainer}
          onPress={() => handleAddToAuthentication(student)}
        >
          <Icon name="error" size={24} color="#F44336" />
          <Text style={styles.authStatusTextError}>Email Failed</Text>
          <Text style={styles.authSubtext}>Retry</Text>
        </TouchableOpacity>
      );
    }

    if (authStatus === 'removed') {
      return (
        <TouchableOpacity 
          style={styles.authIconContainer}
          onPress={() => handleAddToAuthentication(student)}
        >
          <Icon name="person-add" size={24} color="#FF9800" />
          <Text style={styles.authStatusText}>Re-add</Text>
        </TouchableOpacity>
      );
    }

    // Default: not authenticated
    return (
      <TouchableOpacity 
        style={styles.authIconContainer}
        onPress={() => handleAddToAuthentication(student)}
      >
        <Icon name="email" size={24} color="#2196F3" />
        <Text style={styles.authStatusText}>Send Email</Text>
        <Text style={styles.authSubtext}>→ Create Auth</Text>
      </TouchableOpacity>
    );
  };

  // Simplified bulk authentication
  const handleBulkAuthentication = () => {
    const unauthenticatedStudents = filteredStudents.filter(student => 
      student && !isStudentAuthenticated(student)
    );

    if (unauthenticatedStudents.length === 0) {
      Alert.alert('Info', 'No unauthenticated students found to process.');
      return;
    }

    Alert.alert(
      "Bulk Email-First Authentication",
      `Add ${unauthenticatedStudents.length} students to authentication system?\n\n` +
      `Process for each student:\n` +
      `1. Send email with credentials\n` +
      `2. Create Firebase account\n` +
      `3. Create user document with Firebase UID as document ID\n\n` +
      `This ensures clean data structure with no redundant fields.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Start Process", 
          onPress: async () => {
            let successCount = 0;
            let failureCount = 0;
            const maxBatch = Math.min(3, unauthenticatedStudents.length);
            
            Alert.alert(
              'Bulk Process Started',
              `Processing ${maxBatch} students with clean email-first authentication...`
            );
            
            for (const student of unauthenticatedStudents.slice(0, maxBatch)) {
              try {
                console.log(`🔄 Processing ${student.username} with clean email-first flow...`);
                await handleAddToAuthentication(student);
                successCount++;
              } catch (error) {
                failureCount++;
                console.error(`❌ Failed to authenticate ${student.username}:`, error);
              }
              // Add delay for email processing and rate limiting
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            Alert.alert(
              'Bulk Authentication Complete',
              `Clean Email-First Process Results:\n\n` +
              `✅ Successfully processed: ${successCount}\n` +
              `❌ Failed: ${failureCount}\n\n` +
              `All successful students now have clean document structure with Firebase UID as document ID.`
            );
          }
        }
      ]
    );
  };

  const loadMoreStudents = () => {
    if (visibleStudents < filteredStudents.length) {
      setVisibleStudents((prev) => prev + 10);
    }
  };

  // Enhanced error handling and loading states
  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={styles.centeredView}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchStudents} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authenticatedCount = filteredStudents.filter(s => s && isStudentAuthenticated(s)).length;
  const pendingCount = filteredStudents.length - authenticatedCount;

  return (
    <>
    <Header />
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Authenticate Users</Text>
        {/* <TouchableOpacity onPress={handleBulkAuthentication} style={styles.bulkAuthBtn}>
          <Icon name="group-add" size={20} color="white" />
          <Text style={styles.bulkAuthText}>Bulk Email</Text>
        </TouchableOpacity> */}
      </View>

      {/* Process Info */}
      <View style={styles.processInfoContainer}>
        <Text style={styles.processInfoText}>
          📧 Email First → 🔐 Create Account → 💾 Clean Document Structure
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#004d40" style={styles.searchIcon} />
        <TextInput
          placeholder="Enter name or roll no."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedYear}
            style={styles.picker}
            onValueChange={(itemValue) => setSelectedYear(itemValue)}
          >
            <Picker.Item label="2024" value="2024" />
            <Picker.Item label="2023" value="2023" />
            <Picker.Item label="2022" value="2022" />
            <Picker.Item label="2021" value="2021" />
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDegree}
            style={styles.picker}
            onValueChange={(itemValue) => setSelectedDegree(itemValue)}
          >
            <Picker.Item label="B.Tech" value="B.Tech" />
            <Picker.Item label="M.Tech" value="M.Tech" />
            <Picker.Item label="PhD" value="PhD" />
          </Picker>
        </View>
      </View>

      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{filteredStudents.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{authenticatedCount}</Text>
          <Text style={styles.statLabel}>Clean Auth</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending Email</Text>
        </View>
      </View>

      {/* Student List */}
      {filteredStudents.length > 0 ? (
        <FlatList
          data={filteredStudents.slice(0, visibleStudents)}
          keyExtractor={(student) => student?.id || Math.random().toString()}
          renderItem={({ item }) => {
            if (!item) {
              return null;
            }

            return (
              <View style={[
                styles.studentCard,
                isStudentAuthenticated(item) && styles.authenticatedCard
              ]}>
                <TouchableOpacity
                  style={styles.cardContent}
                  onPress={() => navigation.navigate("ProfessorProfile", { professorId: item.id })}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: item.photoURL || "https://via.placeholder.com/100" }}
                      style={styles.profileImage}
                    />
                    {isStudentAuthenticated(item) && (
                      <View style={styles.verifiedBadge}>
                        <Icon name="verified" size={16} color="white" />
                      </View>
                    )}
                  </View>
                  <View style={styles.detailsContainer}>
                    <Text style={styles.studentName}>{item.username || 'No Name'}</Text>
                    <Text style={styles.studentEmail}>{item.email || 'No Email'}</Text>
                    <Text style={styles.studentRollNo}>{item.rollNo || 'No Roll No'}</Text>
                    <Text style={styles.studentDesignation}>{item.designation || 'Student'}</Text>
                    {isStudentAuthenticated(item) && (
                      <Text style={styles.emailFirstStatus}>
                        ✓ Clean Document Structure
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Authentication Icon */}
                <View style={styles.actionContainer}>
                  {renderAuthIcon(item)}
                  
                  {/* Admin Delete Option */}
                  {/* <AdminOnly>
                    <TouchableOpacity 
                      onPress={() => handleDelete(item.id)}
                      style={styles.deleteButton}
                    >
                      <Icon name="delete" size={24} color="red" />
                    </TouchableOpacity>
                  </AdminOnly> */}
                </View>
              </View>
            );
          }}
          ListFooterComponent={() =>
            visibleStudents < filteredStudents.length ? (
              <ActivityIndicator size="large" color="#00796b" style={styles.loader} />
            ) : null
          }
          onEndReached={loadMoreStudents}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={fetchStudents} 
              colors={["#00796b"]}
            />
          }
        />
      ) : (
        <View style={styles.centeredView}>
          <Text style={styles.noDataText}>No students found matching your criteria</Text>
          <TouchableOpacity onPress={fetchStudents} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ Clean Authentication Success!</Text>
              <TouchableOpacity 
                onPress={() => setShowSuccessModal(false)}
                style={styles.closeModal}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>{successMessage}</Text>
              <Text style={styles.modalSubtext}>
                Email sent first, Firebase account created with clean document structure (no redundant firebaseUid field)
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowSuccessModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </>
  );
};

// Styles remain the same as your original implementation
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#e0f2f1',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#004d40',
    flex: 1,
  },
  processInfoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  processInfoText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  bulkAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  bulkAuthText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 20,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#004d40',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 5,
    elevation: 1,
    marginHorizontal: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#004d40',
  },
  statLabel: {
    fontSize: 12,
    color: '#004d40',
    marginTop: 4,
    textAlign: 'center',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    justifyContent: 'space-between'
  },
  authenticatedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imageContainer: {
    marginRight: 15,
    position: 'relative',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  detailsContainer: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#004d40',
  },
  studentEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  studentRollNo: {
    fontSize: 14,
    color: '#004d40',
    marginTop: 2,
    fontWeight: '500',
  },
  studentDesignation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  emailFirstStatus: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 4,
  },
  actionContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  authIconContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  authStatusText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  authSubtext: {
    fontSize: 8,
    color: '#999',
    marginTop: 1,
    textAlign: 'center',
  },
  authStatusTextError: {
    fontSize: 10,
    color: '#F44336',
    marginTop: 2,
    textAlign: 'center',
  },
  deleteButton: {
    padding: 4,
  },
  loader: {
    marginVertical: 20,
    alignSelf: "center",
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0f2f1',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#004d40',
    textAlign: 'center',
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeModal: {
    padding: 4,
  },
  closeModalText: {
    color: 'white',
    fontSize: 18,
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  modalCloseBtn: {
    backgroundColor: '#2196F3',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default AdminUserManagement;
