import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { AdminOnly } from '../utils';

const AdminDashboardNew = () => {
  const navigation = useNavigation();
//   const { students, professors, staff, allUsers } = useSelector((state) => state.user);

//   // Calculate statistics
//   const totalStudents = students?.length || 0;
//   const totalProfessors = professors?.length || 0;
//   const totalUsers = totalStudents + totalProfessors + (staff?.length || 0);

  return (
    <>
   
    {/* // <AdminOnly> */}
      <Header />
      <ScrollView style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>


        {/* Main Action Buttons */}
        <View style={styles.buttonsContainer}>
          
          {/* Excel Sheet Upload Button */}
          <TouchableOpacity 
            style={[styles.actionButton, styles.uploadButton]}
            onPress={() => navigation.navigate('ExcelUserUpload')}
          >
            <Icon name="upload-file" size={40} color="#fff" />
            <Text style={styles.buttonTitle}>Excel Sheet Upload</Text>
            <Text style={styles.buttonSubtitle}>Upload user data from CSV/Excel</Text>
          </TouchableOpacity>

          {/* Admin User Management Button */}
          <TouchableOpacity 
            style={[styles.actionButton, styles.managementButton]}
            onPress={() => navigation.navigate('AddAdminUsers')}
          >
            <Icon name="admin-panel-settings" size={40} color="#fff" />
            <Text style={styles.buttonTitle}>User Management</Text>
            <Text style={styles.buttonSubtitle}>Manage users & authentication</Text>
          </TouchableOpacity>
          {/* Admin User Management Button */}
          <TouchableOpacity 
            style={[styles.actionButton, styles.managementButton]}
            onPress={() => navigation.navigate('ProfessorAuthentication')}
          >
            <Icon name="admin-panel-settings" size={40} color="#fff" />
            <Text style={styles.buttonTitle}>Professor Management</Text>
            <Text style={styles.buttonSubtitle}>Manage Professors & authentication</Text>
          </TouchableOpacity>
          
        </View>
      </ScrollView>
    {/* // </AdminOnly> */}

     </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0f2f1',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#004d40',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    minWidth: 80,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#004d40',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 20,
  },
  actionButton: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    elevation: 4,
  },
  uploadButton: {
    backgroundColor: '#2196F3',
  },
  managementButton: {
    backgroundColor: '#4CAF50',
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 5,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
});

export default AdminDashboardNew;
