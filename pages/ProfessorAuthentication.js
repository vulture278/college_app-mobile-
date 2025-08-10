import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getProfessors, deleteUser } from "../store/userSlice";
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
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase imports for authentication
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../FirebaseConfig";

import { AdminOnly } from "../utils";
import Header from '../components/Header';

const ProfessorAuthentication = () => {
  const dispatch = useDispatch();
  const { professors, loading, error } = useSelector((state) => state.user);
  
  const {
    status: emailStatus,
    message: emailMessage,
    isSent: emailSent,
    isSending: emailSending,
    isNotSent: emailFailed
  } = useSelector(state => state.email || {});

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProfessors, setFilteredProfessors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleProfessors, setVisibleProfessors] = useState(10);
  const [selectedDesignation, setSelectedDesignation] = useState("All");
  
  // Authentication states
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

  // Load auth statuses from storage
  const loadAuthStatuses = async () => {
    try {
      const stored = await AsyncStorage.getItem('professorAuthStatuses');
      if (stored) {
        const parsedStatuses = JSON.parse(stored);
        console.log('📱 Loaded professor auth statuses:', parsedStatuses);
        setAuthStatuses(parsedStatuses);
      }
    } catch (error) {
      console.error('❌ Error loading professor auth statuses:', error);
    }
  };

  // Save auth statuses to storage
  const saveAuthStatuses = async (statuses) => {
    try {
      await AsyncStorage.setItem('professorAuthStatuses', JSON.stringify(statuses));
      setAuthStatuses(statuses);
      console.log('💾 Professor auth statuses saved:', statuses);
    } catch (error) {
      console.error('❌ Error saving professor auth statuses:', error);
    }
  };

  // Update processing step for UI feedback
  const setProcessingStep = (professorId, step) => {
    setCurrentProcessingStep(prev => ({
      ...prev,
      [professorId]: step
    }));
  };

  const fetchProfessors = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Fetching professors...');
      await dispatch(getProfessors());
      console.log('✅ Professors fetched successfully');
    } catch (error) {
      console.error('❌ Error fetching professors:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfessors();
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

  // Enhanced filtering for professors
  useEffect(() => {
    console.log('🔍 Filtering professors...', {
      professorsCount: professors?.length || 0,
      selectedDesignation,
      searchQuery: searchQuery?.trim() || ''
    });

    // Safety check for professors array
    if (!professors || !Array.isArray(professors)) {
      console.warn('⚠️ No professors array or not an array');
      setFilteredProfessors([]);
      return;
    }

    // Enhanced sorting with null safety
    let sortedProfessors = [...professors].sort((a, b) => {
      const nameA = String(a?.username || '').toLowerCase();
      const nameB = String(b?.username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Filter by designation
    let filteredByDesignation = sortedProfessors;
    if (selectedDesignation !== "All") {
      filteredByDesignation = sortedProfessors.filter(professor => {
        if (!professor || typeof professor !== 'object') {
          console.warn('⚠️ Invalid professor object:', professor);
          return false;
        }
        return String(professor.designation || '').includes(selectedDesignation);
      });
    }

    console.log(`📊 After designation filter (${selectedDesignation}):`, filteredByDesignation.length);

    // Enhanced search filtering with null safety
    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      const searchFiltered = filteredByDesignation.filter(professor => {
        if (!professor || typeof professor !== 'object') {
          return false;
        }
        
        const username = String(professor.username || '').toLowerCase();
        const email = String(professor.email || '').toLowerCase();
        const designation = String(professor.designation || '').toLowerCase();
        
        return username.includes(queryLower) || 
               email.includes(queryLower) || 
               designation.includes(queryLower);
      });
      
      console.log(`🔍 After search filter (${searchQuery}):`, searchFiltered.length);
      setFilteredProfessors(searchFiltered);
    } else {
      setFilteredProfessors(filteredByDesignation);
    }
  }, [searchQuery, professors, selectedDesignation]);

  const handleDelete = (professorId) => {
    Alert.alert(
      "Delete Professor",
      "Are you sure you want to delete this professor?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => dispatch(deleteUser(professorId))
        }
      ]
    );
  };

  // Email-First Authentication for Professors
  const handleAddToAuthentication = async (professor) => {
    if (!professor || !professor.id || !professor.email) {
      Alert.alert('Error', 'Invalid professor data');
      return;
    }

    setProcessingUsers(prev => new Set([...prev, professor.id]));
    
    try {
      const updatedStatuses = {
        ...authStatuses,
        [professor.id]: 'processing'
      };
      setAuthStatuses(updatedStatuses);
      await saveAuthStatuses(updatedStatuses);

      console.log(`🚀 Adding authentication to professor: ${professor.username}`);

      const randomPassword = generateRandomPassword();
      
      // STEP 1: Send authentication email FIRST
      console.log('📧 Step 1: Sending authentication email...');
      setProcessingStep(professor.id, 'Sending Email...');
      
      await dispatch(sendAuthenticationEmail({
        name: professor.username || 'Professor',
        email: professor.email,
        password: randomPassword,
        role: professor.designation || 'Professor'
      })).unwrap();

      console.log('✅ Email sent successfully - creating Firebase Auth account...');
      setProcessingStep(professor.id, 'Creating Auth Account...');
      
      // STEP 2: Create Firebase Auth account
      console.log('🔐 Step 2: Creating Firebase Auth account...');
      
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH, 
        professor.email, 
        randomPassword
      );
      
      const newFirebaseUID = userCredential.user.uid;
      console.log('✅ New Firebase Auth UID created:', newFirebaseUID);
      
      // STEP 3: Update existing professor document
      console.log('💾 Step 3: Updating professor document with Firebase Auth UID...');
      await updateDoc(doc(FIREBASE_DB, "users", professor.id), {
        uid: newFirebaseUID, // Update existing uid field with Firebase Auth UID
        isAuthenticated: true,
        authenticationDate: Timestamp.now(),
        emailSent: true,
        emailSentDate: Timestamp.now(),
        authenticationFlow: 'email-first',
        lastUpdated: Timestamp.now()
      });
      
      console.log('✅ Professor document updated with Firebase Auth UID');
      setProcessingStep(professor.id, 'Complete');

      // Update local state
      const finalStatuses = {
        ...updatedStatuses,
        [professor.id]: 'authenticated'
      };
      setAuthStatuses(finalStatuses);
      await saveAuthStatuses(finalStatuses);

      // Add to email history
      dispatch(addToEmailHistory({
        type: 'authentication',
        recipient: professor.email,
        recipientName: professor.username || 'Professor',
        status: 'sent',
        role: professor.designation || 'Professor',
        timestamp: new Date().toISOString()
      }));

      // Refresh the professors list
      await fetchProfessors();

      Alert.alert(
        'Authentication Complete', 
        `Process completed successfully for ${professor.username}:\n\n` +
        `1. ✓ Email sent to: ${professor.email}\n` +
        `2. ✓ Firebase account created\n` +
        `3. ✓ Professor account authenticated\n\n` +
        `${professor.username} can now login to the system.`
      );
      
    } catch (error) {
      console.error('❌ Authentication process failed:', error);
      
      // Update auth status to failed
      const failedStatuses = {
        ...authStatuses,
        [professor.id]: 'failed'
      };
      setAuthStatuses(failedStatuses);
      await saveAuthStatuses(failedStatuses);
      setProcessingStep(professor.id, 'Failed');

      // Show specific error messages
      let errorMessage = 'Failed to add professor to authentication system';
      
      if (error.message && error.message.includes('email')) {
        errorMessage = `Email delivery failed: ${error.message}\n\nNo authentication account was created.`;
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered in Firebase Auth.\n\nThe professor may already have authentication enabled.';
      } else {
        errorMessage = `Failed to add authentication: ${error.message || 'Unknown error'}`;
      }

      Alert.alert('Authentication Failed', errorMessage);
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(professor.id);
        return newSet;
      });
      
      setCurrentProcessingStep(prev => {
        const newState = { ...prev };
        delete newState[professor.id];
        return newState;
      });
    }
  };

  // Remove professor from authentication
  const handleRemoveFromAuthentication = async (professor) => {
    Alert.alert(
      "Remove Authentication",
      `Remove ${professor.username} from authentication system?\n\nThis will disable their login access.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(FIREBASE_DB, "users", professor.id), {
                isAuthenticated: false,
                authenticationRemovedDate: Timestamp.now(),
                uid: null,
                lastUpdated: Timestamp.now()
              });

              // Update local state
              const updatedStatuses = {
                ...authStatuses,
                [professor.id]: 'removed'
              };
              setAuthStatuses(updatedStatuses);
              await saveAuthStatuses(updatedStatuses);

              await fetchProfessors();
              Alert.alert('Success', `${professor.username} removed from authentication system`);
            } catch (error) {
              console.error('❌ Remove authentication error:', error);
              Alert.alert('Error', 'Failed to remove professor from authentication system');
            }
          }
        }
      ]
    );
  };

  // Check if professor is authenticated
  const isProfessorAuthenticated = (professor) => {
    if (!professor || typeof professor !== 'object') {
      return false;
    }
    return professor.isAuthenticated === true || authStatuses[professor.id] === 'authenticated';
  };

  // Get auth status for a professor
  const getAuthStatus = (professorId) => {
    return authStatuses[professorId] || 'not_authenticated';
  };

  // Check if professor has email sent
  const isEmailSent = (professor) => {
    if (!professor || typeof professor !== 'object') {
      return false;
    }
    return professor.emailSent === true;
  };

  // Render authentication icon based on status
  const renderAuthIcon = (professor) => {
    if (!professor) {
      return null;
    }

    const isAuthenticated = isProfessorAuthenticated(professor);
    const authStatus = getAuthStatus(professor.id);
    const isProcessing = processingUsers.has(professor.id);
    const processingStep = currentProcessingStep[professor.id];

    if (isAuthenticated || authStatus === 'authenticated') {
      return (
        <TouchableOpacity 
          style={styles.authIconContainer}
          onPress={() => handleRemoveFromAuthentication(professor)}
        >
          <Icon name="verified-user" size={24} color="#4CAF50" />
          <Text style={styles.authStatusText}>Authenticated</Text>
          <Text style={styles.authSubtext}>Email → Auth</Text>
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
          onPress={() => handleAddToAuthentication(professor)}
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
          onPress={() => handleAddToAuthentication(professor)}
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
        onPress={() => handleAddToAuthentication(professor)}
      >
        <Icon name="email" size={24} color="#2196F3" />
        <Text style={styles.authStatusText}>Send Email</Text>
        <Text style={styles.authSubtext}>→ Create Auth</Text>
      </TouchableOpacity>
    );
  };

  // Bulk authentication for professors
  const handleBulkAuthentication = () => {
    const unauthenticatedProfessors = filteredProfessors.filter(professor => 
      professor && !isProfessorAuthenticated(professor)
    );

    if (unauthenticatedProfessors.length === 0) {
      Alert.alert('Info', 'No unauthenticated professors found to process.');
      return;
    }

    Alert.alert(
      "Bulk Professor Authentication",
      `Add ${unauthenticatedProfessors.length} professors to authentication system?\n\n` +
      `Process for each professor:\n` +
      `1. Send email with credentials\n` +
      `2. Create Firebase account\n` +
      `3. Update professor record\n\n` +
      `This ensures professors receive login info before accounts are created.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Start Process", 
          onPress: async () => {
            let successCount = 0;
            let failureCount = 0;
            const maxBatch = Math.min(3, unauthenticatedProfessors.length);
            
            Alert.alert(
              'Bulk Process Started',
              `Processing ${maxBatch} professors with email-first authentication...`
            );
            
            for (const professor of unauthenticatedProfessors.slice(0, maxBatch)) {
              try {
                console.log(`🔄 Processing ${professor.username} with email-first flow...`);
                await handleAddToAuthentication(professor);
                successCount++;
              } catch (error) {
                failureCount++;
                console.error(`❌ Failed to authenticate ${professor.username}:`, error);
              }
              // Add delay for email processing and rate limiting
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            Alert.alert(
              'Bulk Authentication Complete',
              `Professor Authentication Results:\n\n` +
              `✅ Successfully processed: ${successCount}\n` +
              `❌ Failed: ${failureCount}\n\n` +
              `All successful professors received their login credentials via email.`
            );
          }
        }
      ]
    );
  };

  const loadMoreProfessors = () => {
    if (visibleProfessors < filteredProfessors.length) {
      setVisibleProfessors((prev) => prev + 10);
    }
  };

  // Loading and error states
  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={styles.centeredView}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchProfessors} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authenticatedCount = filteredProfessors.filter(p => p && isProfessorAuthenticated(p)).length;
  const pendingCount = filteredProfessors.length - authenticatedCount;

  return (
    <>
      <Header />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Authenticate Professors</Text>
          <TouchableOpacity onPress={handleBulkAuthentication} style={styles.bulkAuthBtn}>
            <Icon name="group-add" size={20} color="white" />
            <Text style={styles.bulkAuthText}>Bulk Email</Text>
          </TouchableOpacity>
        </View>

        {/* Process Info */}
        <View style={styles.processInfoContainer}>
          <Text style={styles.processInfoText}>
            📧 Email First → 🔐 Create Account → 💾 Update Professor Record
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#004d40" style={styles.searchIcon} />
          <TextInput
            placeholder="Enter professor name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Designation Filter */}
        <View style={styles.filterContainer}>
          <View style={styles.pickerContainer}>
            <TouchableOpacity
              style={[styles.filterButton, selectedDesignation === "All" && styles.activeFilter]}
              onPress={() => setSelectedDesignation("All")}
            >
              <Text style={[styles.filterText, selectedDesignation === "All" && styles.activeFilterText]}>
                All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, selectedDesignation === "Professor" && styles.activeFilter]}
              onPress={() => setSelectedDesignation("Professor")}
            >
              <Text style={[styles.filterText, selectedDesignation === "Professor" && styles.activeFilterText]}>
                Professor
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, selectedDesignation === "Assistant" && styles.activeFilter]}
              onPress={() => setSelectedDesignation("Assistant")}
            >
              <Text style={[styles.filterText, selectedDesignation === "Assistant" && styles.activeFilterText]}>
                Assistant
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, selectedDesignation === "Visiting" && styles.activeFilter]}
              onPress={() => setSelectedDesignation("Visiting")}
            >
              <Text style={[styles.filterText, selectedDesignation === "Visiting" && styles.activeFilterText]}>
                Visiting
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Header */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{filteredProfessors.length}</Text>
            <Text style={styles.statLabel}>Total Professors</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{authenticatedCount}</Text>
            <Text style={styles.statLabel}>Authenticated</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending Email</Text>
          </View>
        </View>

        {/* Professor List */}
        {filteredProfessors.length > 0 ? (
          <FlatList
            data={filteredProfessors.slice(0, visibleProfessors)}
            keyExtractor={(professor) => professor?.id || Math.random().toString()}
            renderItem={({ item }) => {
              if (!item) {
                return null;
              }

              return (
                <View style={[
                  styles.professorCard,
                  isProfessorAuthenticated(item) && styles.authenticatedCard
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
                      {isProfessorAuthenticated(item) && (
                        <View style={styles.verifiedBadge}>
                          <Icon name="verified" size={16} color="white" />
                        </View>
                      )}
                    </View>
                    <View style={styles.detailsContainer}>
                      <Text style={styles.professorName}>{item.username || 'No Name'}</Text>
                      <Text style={styles.professorEmail}>{item.email || 'No Email'}</Text>
                      <Text style={styles.professorDesignation}>{item.designation || 'Professor'}</Text>
                      <Text style={styles.professorPhone}>{item.phone || 'No Phone'}</Text>
                      {isProfessorAuthenticated(item) && (
                        <Text style={styles.emailFirstStatus}>
                          ✓ Email-First Authentication Complete
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Authentication Icon */}
                  <View style={styles.actionContainer}>
                    {renderAuthIcon(item)}
                    
                    {/* Admin Delete Option */}
                    <AdminOnly>
                      <TouchableOpacity 
                        onPress={() => handleDelete(item.id)}
                        style={styles.deleteButton}
                      >
                        <Icon name="delete" size={24} color="red" />
                      </TouchableOpacity>
                    </AdminOnly>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={() =>
              visibleProfessors < filteredProfessors.length ? (
                <ActivityIndicator size="large" color="#00796b" style={styles.loader} />
              ) : null
            }
            onEndReached={loadMoreProfessors}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={fetchProfessors} 
                colors={["#00796b"]}
              />
            }
          />
        ) : (
          <View style={styles.centeredView}>
            <Text style={styles.noDataText}>No professors found matching your criteria</Text>
            <TouchableOpacity onPress={fetchProfessors} style={styles.retryButton}>
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
                <Text style={styles.modalTitle}>✅ Professor Authentication Success!</Text>
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
                  Email sent first, then Firebase account created and professor record updated
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
    marginBottom: 15,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 5,
    elevation: 1,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  activeFilter: {
    backgroundColor: '#00796b',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
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
  professorCard: {
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
  professorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#004d40',
  },
  professorEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  professorDesignation: {
    fontSize: 14,
    color: '#004d40',
    marginTop: 2,
    fontWeight: '500',
  },
  professorPhone: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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

export default ProfessorAuthentication;
