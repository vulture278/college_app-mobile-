import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';
import { FIREBASE_DB } from '../FirebaseConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';

const ExcelUserUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Default photo URL from your example
  const DEFAULT_PHOTO_URL = "https://img.freepik.com/free-vector/illustration-businessman_53876-5856.jpg?w=740&t=st=1721141254~exp=1721141854~hmac=16b7be7a26efb621a8073b1e8204f34be34595f0d723d5c8ae9279435c66a530";

  // FIXED: Pick CSV/Excel file with multiple MIME type approaches
  const pickFile = async () => {
    try {
      console.log('🔍 Starting file picker...');
      
      // Method 1: Try with multiple MIME types array (newer Expo versions)
      let result;
      try {
        result = await DocumentPicker.getDocumentAsync({
          type: [
            'text/csv',
            'text/comma-separated-values',
            'application/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });
      } catch (arrayError) {
        console.log('📝 Array method failed, trying single type:', arrayError.message);
        
        // Method 2: Fallback to single MIME type
        result = await DocumentPicker.getDocumentAsync({
          type: 'text/csv', // Focus on CSV first
          copyToCacheDirectory: true,
          multiple: false,
        });
      }

      console.log('📄 File picker result:', result);

      // Handle both old and new response formats
      if (result.type === 'success' || (!result.canceled && result.assets)) {
        const fileData = result.assets ? result.assets[0] : result;
        console.log('✅ File selected:', fileData);
        
        setSelectedFile(fileData);
        parseFile(fileData);
      } else {
        console.log('❌ File selection canceled');
      }
    } catch (error) {
      console.error('❌ File picker error:', error);
      Alert.alert('Error', 'Failed to pick file: ' + error.message);
    }
  };

  // Alternative file picker for different file types
  const pickFileAlternative = async (fileType = 'csv') => {
    try {
      let mimeType;
      switch (fileType) {
        case 'csv':
          mimeType = 'text/csv';
          break;
        case 'excel':
          mimeType = 'application/vnd.ms-excel';
          break;
        case 'xlsx':
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        default:
          mimeType = '*/*'; // Allow all files as fallback
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeType,
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log(`📄 ${fileType.toUpperCase()} picker result:`, result);

      if (result.type === 'success' || (!result.canceled && result.assets)) {
        const fileData = result.assets ? result.assets[0] : result;
        setSelectedFile(fileData);
        parseFile(fileData);
      }
    } catch (error) {
      console.error(`❌ ${fileType} picker error:`, error);
      Alert.alert('Error', `Failed to pick ${fileType} file: ` + error.message);
    }
  };

  // FIXED: Parse CSV file with better error handling
  const parseFile = async (file) => {
    try {
      setIsProcessing(true);
      console.log('📖 Starting to parse file:', file.name);
      
      // Read file content using Expo FileSystem with better error handling
      let fileContent;
      try {
        fileContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (readError) {
        console.error('❌ File read error:', readError);
        Alert.alert('Error', 'Cannot read the selected file. Please try selecting the file again.');
        setIsProcessing(false);
        return;
      }
      
      // console.log('📊 File content length:', fileContent.length);
      // console.log('📊 First 100 characters:', fileContent.substring(0, 100));

      // Parse CSV using Papa Parse with better error handling
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          console.log('🔄 Transforming header:', header);
          return mapHeaderToField(header.toLowerCase().trim());
        },
        transform: (value, header) => {
          console.log(`🔄 Transforming value for ${header}:`, value);
          return value ? value.trim() : '';
        },
        complete: (results) => {
          console.log('✅ Parse completed:', results);
          if (results.errors && results.errors.length > 0) {
            console.warn('⚠️ Parse warnings:', results.errors);
          }
          processParseResults(results.data);
        },
        error: (error) => {
          console.error('❌ Parse error:', error);
          Alert.alert('Error', 'Failed to parse CSV file: ' + error.message);
          setIsProcessing(false);
        }
      });

    } catch (error) {
      setIsProcessing(false);
      console.error('❌ File parsing error:', error);
      Alert.alert('Error', 'Failed to process file: ' + error.message);
    }
  };

  // Process parsed CSV data
  const processParseResults = (data) => {
    // console.log('🔄 Processing parsed data:', data);

    if (!data || data.length === 0) {
      Alert.alert('Error', 'The CSV file appears to be empty or invalid.');
      setIsProcessing(false);
      return;
    }

    // Map data to objects with proper validation
    const mappedData = data.map((row, index) => {
      // console.log(`🔄 Processing row ${index + 1}:`, row);
      
      const userObj = {
        bio: row.bio || '',
        degree: row.degree || 'B.Tech',
        designation: row.designation || 'Student',
        email: row.email || '',
        phone: row.phone || '',
        photoURL: row.photoURL || DEFAULT_PHOTO_URL,
        rollNo: row.rollNo || '',
        username: row.username || '',
        createdAt: Timestamp.now(),
      };

      return {
        ...userObj,
        rowIndex: index + 1,
        isValid: userObj.email && userObj.username
      };
    });

    const validData = mappedData.filter(item => item.isValid);
    const invalidData = mappedData.filter(item => !item.isValid);

    // console.log('✅ Valid records:', validData.length);
    // console.log('❌ Invalid records:', invalidData.length);

    if (validData.length === 0) {
      Alert.alert(
        'No Valid Data', 
        'No valid records found. Please ensure your CSV has email and username columns.'
      );
      setIsProcessing(false);
      return;
    }

    if (invalidData.length > 0) {
      Alert.alert(
        'Warning',
        `Found ${invalidData.length} invalid records (missing email or username). Only ${validData.length} valid records will be processed.`
      );
    }

    setParsedData(validData);
    setIsProcessing(false);
  };

  // Enhanced header mapping
  const mapHeaderToField = (header) => {
    console.log('🔄 Mapping header:', header);
    
    const mapping = {
      // Bio variations
      'bio': 'bio',
      'biography': 'bio',
      'about': 'bio',
      
      // Degree variations
      'degree': 'degree',
      'course': 'degree',
      'program': 'degree',
      
      // Designation variations
      'designation': 'designation',
      'role': 'designation',
      'position': 'designation',
      
      // Email variations
      'email': 'email',
      'email_address': 'email',
      'e-mail': 'email',
      'mail': 'email',
      
      // Phone variations
      'phone': 'phone',
      'telephone': 'phone',
      'mobile': 'phone',
      'contact': 'phone',
      'phone_number': 'phone',
      
      // Photo URL variations
      'photourl': 'photoURL',
      'photo_url': 'photoURL',
      'image_url': 'photoURL',
      'avatar': 'photoURL',
      
      // Roll number variations
      'rollno': 'rollNo',
      'roll_no': 'rollNo',
      'roll no': 'rollNo',
      'roll_number': 'rollNo',
      'student_id': 'rollNo',
      'id': 'rollNo',
      
      // Username variations
      'username': 'username',
      'name': 'username',
      'user_name': 'username',
      'user name': 'username',
      'full_name': 'username',
      'student_name': 'username',
    };
    
    const mapped = mapping[header] || header;
    // console.log(`🔄 Header "${header}" mapped to "${mapped}"`);
    return mapped;
  };

  // Check if user exists by email
  const checkUserExists = async (email) => {
    try {
      const q = query(
        collection(FIREBASE_DB, 'users'),
        where('email', '==', email)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  };

  // Upload users to Firebase
  const uploadUsersToFirebase = async () => {
    if (parsedData.length === 0) {
      Alert.alert('Error', 'No data to upload');
      return;
    }

    Alert.alert(
      'Confirm Upload',
      `Upload ${parsedData.length} users to Firebase?\n\nThis will check for existing emails and skip duplicates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Upload', 
          onPress: () => performUpload(),
          style: 'default'
        }
      ]
    );
  };

  const performUpload = async () => {
    setIsProcessing(true);
    setUploadResults([]);
    setShowResults(false);
    
    const results = [];
    const totalUsers = parsedData.length;
    let processedCount = 0;

    for (const userData of parsedData) {
      try {
        setUploadProgress({
          current: processedCount + 1,
          total: totalUsers,
          currentUser: userData.username,
          status: 'Checking email...'
        });

        // Check if user already exists
        const userExists = await checkUserExists(userData.email);
        
        if (userExists) {
          results.push({
            ...userData,
            status: 'skipped',
            message: 'User with this email already exists'
          });
        } else {
          setUploadProgress(prev => ({
            ...prev,
            status: 'Adding to database...'
          }));

          // Add user to Firestore
          const userDocData = {
            bio: userData.bio,
            createdAt: Timestamp.now(),
            degree: userData.degree,
            designation: userData.designation,
            email: userData.email,
            phone: userData.phone,
            photoURL: userData.photoURL,
            rollNo: userData.rollNo,
            username: userData.username
          };

          await addDoc(collection(FIREBASE_DB, 'users'), userDocData);
          
          results.push({
            ...userData,
            status: 'success',
            message: 'Successfully added to database'
          });
        }
      } catch (error) {
        console.error(`Error processing user ${userData.email}:`, error);
        results.push({
          ...userData,
          status: 'error',
          message: `Failed to process: ${error.message}`
        });
      }
      
      processedCount++;
      
      // Add small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setUploadResults(results);
    setIsProcessing(false);
    setShowResults(true);
    
    // Show summary
    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    Alert.alert(
      'Upload Complete',
      `Results:\n✅ Successfully added: ${successCount}\n⏭️ Skipped (duplicates): ${skippedCount}\n❌ Errors: ${errorCount}`
    );
  };

  // Render upload result item
  const renderResultItem = ({ item }) => (
    <View style={[
      styles.resultItem,
      item.status === 'success' && styles.successItem,
      item.status === 'skipped' && styles.skippedItem,
      item.status === 'error' && styles.errorItem
    ]}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{item.username}</Text>
        <Icon 
          name={
            item.status === 'success' ? 'check-circle' :
            item.status === 'skipped' ? 'info' : 'error'
          }
          size={20}
          color={
            item.status === 'success' ? '#4CAF50' :
            item.status === 'skipped' ? '#FF9800' : '#F44336'
          }
        />
      </View>
      <Text style={styles.resultEmail}>{item.email}</Text>
      <Text style={styles.resultMessage}>{item.message}</Text>
    </View>
  );

  return (
    <>
    
      <Header/>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CSV/Excel User Upload</Text>
        <Text style={styles.headerSubtitle}>
          Upload user data from CSV or Excel files to Firebase
        </Text>
      </View>

      {/* File Selection Buttons */}
      <TouchableOpacity 
        style={styles.filePickerButton}
        onPress={pickFile}
        disabled={isProcessing}
      >
        <Icon name="file-upload" size={24} color="white" />
        <Text style={styles.filePickerText}>
          Select CSV/Excel File (Auto-detect)
        </Text>
      </TouchableOpacity>

      {/* Alternative buttons for specific file types */}
      <View style={styles.alternativeButtons}>
        <TouchableOpacity 
          style={[styles.filePickerButton, styles.csvButton]}
          onPress={() => pickFileAlternative('csv')}
          disabled={isProcessing}
        >
          <Icon name="description" size={20} color="white" />
          <Text style={styles.alternativeButtonText}>CSV Only</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filePickerButton, styles.excelButton]}
          onPress={() => pickFileAlternative('excel')}
          disabled={isProcessing}
        >
          <Icon name="grid-on" size={20} color="white" />
          <Text style={styles.alternativeButtonText}>Excel Only</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity 
          style={[styles.filePickerButton, styles.anyButton]}
          onPress={() => pickFileAlternative('any')}
          disabled={isProcessing}
        >
          <Icon name="folder-open" size={20} color="white" />
          <Text style={styles.alternativeButtonText}>Any File</Text>
        </TouchableOpacity> */}
      </View>

      {selectedFile && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>📄 {selectedFile.name}</Text>
          <Text style={styles.fileSize}>
            Size: {(selectedFile.size / 1024).toFixed(2)} KB
          </Text>
          <Text style={styles.fileMimeType}>
            Type: {selectedFile.mimeType || 'Unknown'}
          </Text>
        </View>
      )}

      {/* Data Preview */}
      {parsedData.length > 0 && !showResults && (
        <View style={styles.dataPreview}>
          <Text style={styles.sectionTitle}>
            Data Preview ({parsedData.length} valid records)
          </Text>
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeaderText}>Username</Text>
            <Text style={styles.previewHeaderText}>Email</Text>
            <Text style={styles.previewHeaderText}>Role</Text>
          </View>
          {parsedData.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.previewRow}>
              <Text style={styles.previewCell}>{item.username}</Text>
              <Text style={styles.previewCell}>{item.email}</Text>
              <Text style={styles.previewCell}>{item.designation}</Text>
            </View>
          ))}
          {parsedData.length > 3 && (
            <Text style={styles.moreRecords}>
              ... and {parsedData.length - 3} more records
            </Text>
          )}
        </View>
      )}

      {/* Upload Button */}
      {parsedData.length > 0 && !showResults && (
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={uploadUsersToFirebase}
          disabled={isProcessing}
        >
          <Icon name="cloud-upload" size={24} color="white" />
          <Text style={styles.uploadButtonText}>
            Upload to Firebase
          </Text>
        </TouchableOpacity>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          {uploadProgress.total && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Processing {uploadProgress.current} of {uploadProgress.total}
              </Text>
              <Text style={styles.progressUser}>
                Current: {uploadProgress.currentUser}
              </Text>
              <Text style={styles.progressStatus}>
                {uploadProgress.status}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Results */}
      {showResults && uploadResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Upload Results</Text>
          <FlatList
            data={uploadResults}
            renderItem={renderResultItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={() => {
              setSelectedFile(null);
              setParsedData([]);
              setUploadResults([]);
              setShowResults(false);
            }}
          >
            <Text style={styles.resetButtonText}>Upload Another File</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  // ... (keeping all your existing styles)
  container: {
    flex: 1,
    backgroundColor: '#e0f2f1',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  filePickerButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
  },
  filePickerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // NEW: Alternative button styles
  alternativeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  csvButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 5,
  },
  excelButton: {
    backgroundColor: '#FF9800',
    flex: 1,
    marginHorizontal: 5,
  },
  anyButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
    marginLeft: 5,
  },
  alternativeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  fileInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
  },
  fileSize: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  fileMimeType: {
    fontSize: 14,
    color: '#666',
  },
  // ... (rest of your existing styles)
  dataPreview: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  previewHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  previewHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  previewRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewCell: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  moreRecords: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  progressInfo: {
    alignItems: 'center',
    marginTop: 15,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  progressUser: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  progressStatus: {
    fontSize: 14,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  successItem: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  skippedItem: {
    backgroundColor: '#fff3e0',
    borderColor: '#FF9800',
  },
  errorItem: {
    backgroundColor: '#ffebee',
    borderColor: '#F44336',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  resultEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  resultMessage: {
    fontSize: 14,
    color: '#333',
  },
  resetButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ExcelUserUpload;
