import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  FIREBASE_AUTH,
  FIREBASE_DB,
  FIREBASE_REALTIME_DB
} from "../FirebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  Timestamp,
  addDoc
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { ref, get } from "firebase/database";

// Helper function to convert Firebase data to serializable format
const convertFirebaseDataToSerializable = (data) => {
  const serializedData = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      serializedData[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && value.toDate) {
      // Handle Timestamp-like objects
      serializedData[key] = value.toDate().toISOString();
    } else {
      serializedData[key] = value;
    }
  }
  
  return serializedData;
};

export const loginUser = createAsyncThunk(
  "user/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const auth = FIREBASE_AUTH;
      const userData = await signInWithEmailAndPassword(auth, email, password);
      return {
        userEmail: userData.user.email,
        uid: userData.user.uid,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchRealtimeData = createAsyncThunk(
  "user/fetchRealtimeData",
  async (_, { rejectWithValue }) => {
    try {
      const databaseRef = ref(FIREBASE_REALTIME_DB, "college-app-data/users");
      const snapshot = await get(databaseRef);

      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        return rejectWithValue("No data found in the database.");
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// FIXED: Corrected uploadUserData as a proper async thunk
// Fixed CSV upload - create Firebase Auth account first, then use UID
export const uploadUserData = createAsyncThunk(
  "users/uploadUserData",
  async ({ userData, password }, { rejectWithValue }) => {
    try {
      // Check if user document already exists
      const existingUserRef = doc(FIREBASE_DB, "users", userData.rollNo);
      const existingUserDoc = await getDoc(existingUserRef);

      if (existingUserDoc.exists()) {
        const existingData = existingUserDoc.data();
        console.log(`User exists with uid: ${existingData.uid}`);
        
        // If password is provided, create Firebase Auth account
        if (password) {
          const userCredential = await createUserWithEmailAndPassword(
            FIREBASE_AUTH, 
            userData.email, 
            password
          );
          
          const firebaseAuthUID = userCredential.user.uid;
          
          // Update the existing uid field with Firebase Auth UID
          await updateDoc(existingUserRef, {
            uid: firebaseAuthUID, // Replace existing uid
            isAuthenticated: true,
            authenticationDate: Timestamp.now(),
            authenticationFlow: 'csv-upload',
            lastUpdated: Timestamp.now()
          });
          
          return {
            message: `Authentication added to ${userData.username}`,
            firebaseUID: firebaseAuthUID
          };
        }
        
        return {
          message: `User ${userData.username} already exists - no authentication added`
        };
        
      } else {
        // Create new user document
        let firebaseAuthUID = null;
        
        if (password) {
          const userCredential = await createUserWithEmailAndPassword(
            FIREBASE_AUTH, 
            userData.email, 
            password
          );
          firebaseAuthUID = userCredential.user.uid;
        }
        
        const userDocumentData = {
          email: userData.email,
          username: userData.username,
          rollNo: userData.rollNo,
          uid: firebaseAuthUID || userData.uid, // Use Firebase UID or existing uid
          // ... other fields
          isAuthenticated: !!firebaseAuthUID,
          createdAt: Timestamp.now()
        };

        await setDoc(existingUserRef, userDocumentData);
        
        return {
          message: `Created user: ${userData.username}`,
          firebaseUID: firebaseAuthUID
        };
      }
    } catch (error) {
      return rejectWithValue(`Failed to process: ${error.message}`);
    }
  }
);



// Proper timestamp handling - getUser fetches by Firebase UID
export const getUser = createAsyncThunk(
  "user/getUser",
  async (uid, { rejectWithValue }) => {
    try {
      console.log('🔍 Fetching user by UID:', uid);
      const userDoc = await getDoc(doc(FIREBASE_DB, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const serializedData = convertFirebaseDataToSerializable(userData);
        
        console.log('✅ User found:', serializedData.username);
        return {
          userEmail: serializedData.email,
          uid: uid, // Document ID IS the Firebase UID
          ...serializedData,
        };
      } else {
        console.warn('❌ No user document found for UID:', uid);
        return rejectWithValue("User not found");
      }
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      return rejectWithValue(error.message);
    }
  }
);

// export const getUser = createAsyncThunk(
//   "user/getUser",
//   async (firebaseUID, { rejectWithValue }) => {
//     try {
//       console.log('🔍 Fetching user by Firebase UID:', firebaseUID);
      
//       // Query by the uid field (which now contains Firebase Auth UID)
//       const userQuery = query(
//         collection(FIREBASE_DB, "users"),
//         where("uid", "==", firebaseUID)
//       );
//       const querySnapshot = await getDocs(userQuery);

//       if (!querySnapshot.empty) {
//         const userDoc = querySnapshot.docs[0];
//         const userData = userDoc.data();
//         const serializedData = convertFirebaseDataToSerializable(userData);
        
//         console.log('✅ User found:', serializedData.username);
//         return {
//           userEmail: serializedData.email,
//           uid: firebaseUID,
//           documentId: userDoc.id,
//           ...serializedData,
//         };
//       } else {
//         return rejectWithValue("User not found");
//       }
//     } catch (error) {
//       return rejectWithValue(error.message);
//     }
//   }
// );

// export const getUser = createAsyncThunk(
//   "user/getUser",
//   async (firebaseUID, { rejectWithValue }) => {
//     try {
//       console.log('🔍 Fetching user by Firebase UID field:', firebaseUID);
      
//       // Query by uid field, not document ID
//       const userQuery = query(
//         collection(FIREBASE_DB, "users"),
//         where("uid", "==", firebaseUID)
//       );
//       const querySnapshot = await getDocs(userQuery);

//       if (!querySnapshot.empty) {
//         const userDoc = querySnapshot.docs[0];
//         const userData = userDoc.data();
//         const serializedData = convertFirebaseDataToSerializable(userData);
        
//         console.log('✅ User found:', serializedData.username);
//         return {
//           userEmail: serializedData.email,
//           uid: firebaseUID, // Firebase Auth UID
//           documentId: userDoc.id, // Original document ID (rollNo)
//           ...serializedData,
//         };
//       } else {
//         console.warn('❌ No user found with UID:', firebaseUID);
//         return rejectWithValue("User not found");
//       }
//     } catch (error) {
//       console.error('❌ Error fetching user:', error);
//       return rejectWithValue(error.message);
//     }
//   }
// );


export const deleteUser = createAsyncThunk(
  "user/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(FIREBASE_DB, "users", userId));
      return userId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUser = createAsyncThunk(
  "user/updateUser",
  async ({ uid, userData }, thunkAPI) => {
    try {
      const userRef = doc(FIREBASE_DB, "users", uid);
      
      // Ensure we don't add redundant firebaseUid field
      const cleanUserData = { ...userData };
      delete cleanUserData.firebaseUid; // Remove if accidentally included
      
      await setDoc(userRef, cleanUserData, { merge: true });
      
      // Return serialized data
      return convertFirebaseDataToSerializable(cleanUserData);
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Fixed: Proper timestamp handling in getProfessors
export const getProfessors = createAsyncThunk(
  "user/getProfessors",
  async (_, { rejectWithValue }) => {
    try {
      const professorsQuery = query(
        collection(FIREBASE_DB, "users"),
        where("designation", "in", [
          "Professor",
          "Visiting Faculty",
          "Assistant Professor",
        ])
      );
      const querySnapshot = await getDocs(professorsQuery);

      const professors = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        professors.push({ id: doc.id, ...serializedData });
      });

      return professors;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fixed: Proper timestamp handling in getStudents
export const getStudents = createAsyncThunk(
  "user/getStudents",
  async (_, { rejectWithValue }) => {
    try {
      console.log('🔍 Fetching students from Firestore...');
      const studentQuery = query(
        collection(FIREBASE_DB, "users"),
        where("designation", "==", "Student")
      );
      const querySnapshot = await getDocs(studentQuery);

      const students = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        
        // Ensure required fields are present and valid
        if (serializedData.email && serializedData.username) {
          students.push({ 
            id: doc.id, // Document ID (Firebase UID)
            ...serializedData 
          });
        } else {
          console.warn('⚠️ Student missing required fields:', doc.id, serializedData);
        }
      });

      console.log('✅ Students fetched successfully:', students.length);
      return students;
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Fixed: Proper timestamp handling in getStaff
export const getStaff = createAsyncThunk(
  "user/getStaff",
  async (_, { rejectWithValue }) => {
    try {
      const staffQuery = query(
        collection(FIREBASE_DB, "users"),
        where("designation", "==", "Office Assistant")
      );
      const querySnapshot = await getDocs(staffQuery);

      const staff = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        staff.push({ id: doc.id, ...serializedData });
      });

      return staff;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fixed: Proper timestamp handling in getVFaculties
export const getVFaculties = createAsyncThunk(
  "user/getVFaculties",
  async (_, { rejectWithValue }) => {
    try {
      const vFacultyQuery = query(
        collection(FIREBASE_DB, "users"),
        where("designation", "==", "Visiting Faculty")
      );
      const querySnapshot = await getDocs(vFacultyQuery);

      const vFaculties = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        vFaculties.push({ id: doc.id, ...serializedData });
      });

      return vFaculties;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fixed: Proper timestamp handling in getAllUsers
export const getAllUsers = createAsyncThunk(
  "user/getAllUsers",
  async (_, { rejectWithValue }) => {
    try {
      const usersQuery = query(collection(FIREBASE_DB, "users"));
      const querySnapshot = await getDocs(usersQuery);

      const users = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        users.push({ id: doc.id, ...serializedData });
      });

      return users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const sendResetEmail = createAsyncThunk(
  "user/sendResetEmail",
  async (email, { rejectWithValue }) => {
    try {
      const auth = FIREBASE_AUTH;
      await sendPasswordResetEmail(auth, email);
      return "Password reset email sent successfully";
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fixed: addUser with clean document structure
export const addUser = createAsyncThunk(
  "user/addUser",
  async ({ userData, firebaseUid }, { rejectWithValue }) => {
    try {
      const defaultProfilePic =
        "https://img.freepik.com/free-vector/illustration-businessman_53876-5856.jpg?w=740&t=st=1721141254~exp=1721141854~hmac=16b7be7a26efb621a8073b1e8204f34be34595f0d723d5c8ae9279435c66a468";

      const profilePic = userData.photoURL || defaultProfilePic;

      // Use Firebase UID as document ID, not userData.uid
      const userRef = doc(FIREBASE_DB, "users", firebaseUid);
      const userDataToSave = {
        ...userData,
        photoURL: profilePic,
        createdAt: Timestamp.now(),
        // ❌ NO firebaseUid field needed
      };
      
      await setDoc(userRef, userDataToSave);
      
      // Return serialized data with document ID
      return {
        id: firebaseUid,
        ...convertFirebaseDataToSerializable(userDataToSave)
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addDegreeToUser = createAsyncThunk(
  "user/addDegreeToUser",
  async (degree, { rejectWithValue }) => {
    try {
      const degreesRef = collection(FIREBASE_DB, "degrees");
      const docRef = await addDoc(degreesRef, degree);
      return { id: docRef.id, ...degree };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserDegrees = createAsyncThunk(
  "user/fetchUserDegrees",
  async (userId, { rejectWithValue }) => {
    try {
      const q = query(
        collection(FIREBASE_DB, "degrees"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const degrees = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const serializedData = convertFirebaseDataToSerializable(data);
        
        return {
          id: doc.id,
          ...serializedData,
          // Handle specific degree date fields if they exist
          startYear: data.startYear?.toDate ? data.startYear.toDate().getFullYear() : serializedData.startYear,
          endYear: data.endYear?.toDate ? data.endYear.toDate().getFullYear() : serializedData.endYear,
        };
      });
      return degrees;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  userEmail: "",
  uid: "",
  username: "",
  photoURL: "",
  educationQualifications: [],
  birthPlace: "",
  designation: "",
  bio: "",
  loading: false,
  error: "",
  isLoading: false,
  phone: "",
  professors: [],
  students: [],
  degrees: [],
  vFaculties: [],
  realtimeData: null,
  staff: [],
  allUsers: [],
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser(state) {
      state.userEmail = "";
      state.uid = "";
      state.username = "";
      state.photoURL = "";
      state.educationQualifications = [];
      state.birthPlace = "";
      state.designation = "";
      state.loading = false;
      state.error = "";
      state.isLoading = false;
      state.bio = "";
      state.phone = "";
      state.degrees = [];
      state.professors = [];
      state.students = [];
      state.vFaculties = [];
      state.allUsers = [];
    },
    setUser(state, action) {
      state.userEmail = action.payload.userEmail;
      state.uid = action.payload.uid;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRealtimeData.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchRealtimeData.fulfilled, (state, action) => {
        state.loading = false;
        state.realtimeData = action.payload;
      })
      .addCase(fetchRealtimeData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userEmail = action.payload.userEmail;
        state.uid = action.payload.uid;
        state.isLoading = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      // Added uploadUserData reducer cases
      .addCase(uploadUserData.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(uploadUserData.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        // Optionally add success message handling
      })
      .addCase(uploadUserData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(getUser.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getUser.fulfilled, (state, action) => {
        state.loading = false;
        // Safely assign all user properties
        const payload = action.payload;
        state.username = payload.username || "";
        state.photoURL = payload.photoURL || "";
        state.educationQualifications = payload.educationQualifications || [];
        state.birthPlace = payload.birthPlace || "";
        state.designation = payload.designation || "";
        state.bio = payload.bio || "";
        state.phone = payload.phone || "";
        state.userEmail = payload.userEmail || "";
        state.uid = payload.uid || "";
        state.isLoading = false;
      })
      .addCase(getUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        // Remove from all relevant arrays
        state.professors = state.professors.filter(
          (professor) => professor.id !== action.payload
        );
        state.students = state.students.filter(
          (student) => student.id !== action.payload
        );
        state.allUsers = state.allUsers.filter(
          (user) => user.id !== action.payload
        );
        state.staff = state.staff.filter(
          (staff) => staff.id !== action.payload
        );
        state.vFaculties = state.vFaculties.filter(
          (faculty) => faculty.id !== action.payload
        );
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isLoading = false;
        // Safely update user properties
        const payload = action.payload;
        if (payload.username !== undefined) state.username = payload.username;
        if (payload.photoURL !== undefined) state.photoURL = payload.photoURL;
        if (payload.bio !== undefined) state.bio = payload.bio;
        if (payload.phone !== undefined) state.phone = payload.phone;
        if (payload.designation !== undefined) state.designation = payload.designation;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(getProfessors.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getProfessors.fulfilled, (state, action) => {
        state.loading = false;
        state.professors = action.payload;
        state.isLoading = false;
      })
      .addCase(getProfessors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(getStudents.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.students = action.payload;
        state.isLoading = false;
      })
      .addCase(getStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(getStaff.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.staff = action.payload;
        state.isLoading = false;
      })
      .addCase(getStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(getVFaculties.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getVFaculties.fulfilled, (state, action) => {
        state.loading = false;
        state.vFaculties = action.payload;
        state.isLoading = false;
      })
      .addCase(getVFaculties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(getAllUsers.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.allUsers = action.payload;
        state.isLoading = false;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(addUser.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(addUser.fulfilled, (state, action) => {
        state.loading = false;
        // Add the new user to allUsers array
        state.allUsers.push(action.payload);
        state.isLoading = false;
      })
      .addCase(addUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      .addCase(addDegreeToUser.fulfilled, (state, action) => {
        // Add the new degree to degrees array
        state.degrees.push(action.payload);
      })
      .addCase(addDegreeToUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(fetchUserDegrees.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserDegrees.fulfilled, (state, action) => {
        state.loading = false;
        state.degrees = action.payload;
      })
      .addCase(fetchUserDegrees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUser, setUser } = userSlice.actions;
export default userSlice.reducer;
