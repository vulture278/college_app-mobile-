import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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
  addDoc,
  where,
  writeBatch,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { ref, get, onValue } from "firebase/database";

// Cache management system
const cache = {
  users: { data: null, timestamp: null, ttl: 5 * 60 * 1000 }, // 5 minutes
  professors: { data: null, timestamp: null, ttl: 10 * 60 * 1000 }, // 10 minutes
  students: { data: null, timestamp: null, ttl: 10 * 60 * 1000 },
  staff: { data: null, timestamp: null, ttl: 10 * 60 * 1000 },
  vFaculties: { data: null, timestamp: null, ttl: 10 * 60 * 1000 },
  realtimeData: { data: null, timestamp: null, ttl: 2 * 60 * 1000 }, // 2 minutes
};

// Cache utility functions
const isCacheValid = (cacheKey) => {
  const cached = cache[cacheKey];
  return cached.data && cached.timestamp && (Date.now() - cached.timestamp < cached.ttl);
};

const setCache = (cacheKey, data) => {
  cache[cacheKey] = {
    data,
    timestamp: Date.now(),
    ttl: cache[cacheKey].ttl
  };
};

const clearCache = (cacheKey = null) => {
  if (cacheKey) {
    cache[cacheKey] = { data: null, timestamp: null, ttl: cache[cacheKey].ttl };
  } else {
    Object.keys(cache).forEach(key => {
      cache[key] = { data: null, timestamp: null, ttl: cache[key].ttl };
    });
  }
};

// Safe timestamp conversion utility
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
};

// Process user data helper
const processUserData = (doc) => {
  const data = doc.data();
  const { createdAt, ...rest } = data;
  return {
    id: doc.id,
    ...rest,
    createdAt: convertTimestamp(createdAt)
  };
};

// Login User
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

// Fetch Realtime Data with caching and listeners
export const fetchRealtimeData = createAsyncThunk(
  "user/fetchRealtimeData",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      // Check cache first
      if (!forceRefresh && isCacheValid('realtimeData')) {
        return cache.realtimeData.data;
      }

      const databaseRef = ref(FIREBASE_REALTIME_DB, "college-app-data/users");
      
      // Set up real-time listener for future updates
      const unsubscribe = onValue(databaseRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCache('realtimeData', data);
          dispatch(updateRealtimeDataFromListener(data));
        }
      });

      // Get initial data
      const snapshot = await get(databaseRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCache('realtimeData', data);
        
        // Store unsubscribe function for cleanup
        dispatch(setRealtimeListener(unsubscribe));
        
        return data;
      } else {
        return rejectWithValue("No data found in the database.");
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Batch upload user data
export const batchUploadUserData = createAsyncThunk(
  "users/batchUploadUserData",
  async (usersArray, { rejectWithValue }) => {
    try {
      const batch = writeBatch(FIREBASE_DB);
      const results = [];

      for (const userData of usersArray) {
        const userDocRef = doc(collection(FIREBASE_DB, "users"), userData.rollNo);
        const userDocSnapshot = await getDoc(userDocRef);

        if (!userDocSnapshot.exists()) {
          batch.set(userDocRef, {
            ...userData,
            createdAt: Timestamp.now()
          });
          results.push(`Queued: ${userData.username}`);
        } else {
          results.push(`Skipped: ${userData.rollNo} already exists`);
        }
      }

      await batch.commit();
      clearCache(); // Clear all cache after batch operation
      return results;
    } catch (error) {
      console.error("Error in batch upload:", error);
      return rejectWithValue("Failed to batch upload users");
    }
  }
);

// Single upload (keeping for backward compatibility)
export const uploadUserData = createAsyncThunk(
  "users/uploadUserData",
  async (userData, { rejectWithValue }) => {
    try {
      const userDocRef = doc(collection(FIREBASE_DB, "users"), userData.rollNo);
      const userDocSnapshot = await getDoc(userDocRef);

      if (!userDocSnapshot.exists()) {
        await setDoc(userDocRef, {
          ...userData,
          createdAt: Timestamp.now()
        });
        clearCache('users'); // Clear users cache
        return `Uploaded: ${userData.username}`;
      } else {
        return `Document for Roll No: ${userData.rollNo} already exists. Skipping...`;
      }
    } catch (error) {
      console.error("Error uploading data to Firestore:", error);
      return rejectWithValue("Failed to upload user data");
    }
  }
);

// Get single user with state checking
export const getUser = createAsyncThunk(
  "user/getUser",
  async ({ uid, useCache = true }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      
      // Check if user is already in state
      if (useCache && state.user.uid === uid && state.user.username) {
        return state.user;
      }

      // Check if user exists in allUsers array
      const existingUser = state.user.allUsers.find(user => user.id === uid);
      if (useCache && existingUser) {
        return existingUser;
      }

      const userDoc = await getDoc(doc(FIREBASE_DB, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          userEmail: userData.email,
          ...userData,
          createdAt: convertTimestamp(userData.createdAt),
        };
      } else {
        return rejectWithValue("User not found");
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Delete user with cache invalidation
export const deleteUser = createAsyncThunk(
  "user/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(FIREBASE_DB, "users", userId));
      clearCache(); // Clear all relevant cache
      return userId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Update user with optimistic updates
export const updateUser = createAsyncThunk(
  "user/updateUser",
  async ({ uid, userData }, { rejectWithValue }) => {
    try {
      const userRef = doc(FIREBASE_DB, "users", uid);
      const updateData = {
        ...userData,
        updatedAt: Timestamp.now()
      };
      
      await setDoc(userRef, updateData, { merge: true });
      clearCache('users'); // Clear users cache
      return { uid, ...updateData };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Optimized single query to get all users then filter
export const getAllUsersOptimized = createAsyncThunk(
  "user/getAllUsersOptimized",
  async ({ forceRefresh = false } = {}, { rejectWithValue }) => {
    try {
      // Check cache first
      if (!forceRefresh && isCacheValid('users')) {
        return cache.users.data;
      }

      const usersQuery = query(collection(FIREBASE_DB, "users"));
      const querySnapshot = await getDocs(usersQuery);

      const users = [];
      querySnapshot.forEach((doc) => {
        users.push(processUserData(doc));
      });

      setCache('users', users);
      return users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get filtered users from cached data
export const getFilteredUsers = createAsyncThunk(
  "user/getFilteredUsers",
  async ({ designation, forceRefresh = false }, { rejectWithValue, dispatch, getState }) => {
    try {
      const state = getState();
      
      // If we don't have all users or cache is stale, fetch all users first
      if (!state.user.allUsers.length || forceRefresh || !isCacheValid('users')) {
        await dispatch(getAllUsersOptimized({ forceRefresh })).unwrap();
      }
      
      const updatedState = getState();
      const allUsers = updatedState.user.allUsers;
      
      // Filter users based on designation
      const filteredUsers = allUsers.filter(user => {
        if (Array.isArray(designation)) {
          return designation.includes(user.designation?.trim());
        }
        return user.designation?.trim() === designation;
      });
      
      return { designation, users: filteredUsers };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get professors using filtered approach
export const getProfessors = createAsyncThunk(
  "user/getProfessors",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      if (!forceRefresh && isCacheValid('professors')) {
        return cache.professors.data;
      }

      const result = await dispatch(getFilteredUsers({
        designation: ["Professor", "Visiting Faculty", "Assistant Professor"],
        forceRefresh
      })).unwrap();
      
      setCache('professors', result.users);
      return result.users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get students using filtered approach
export const getStudents = createAsyncThunk(
  "user/getStudents",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      if (!forceRefresh && isCacheValid('students')) {
        return cache.students.data;
      }

      const result = await dispatch(getFilteredUsers({
        designation: "Student",
        forceRefresh
      })).unwrap();
      
      setCache('students', result.users);
      return result.users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get staff using filtered approach
export const getStaff = createAsyncThunk(
  "user/getStaff",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      if (!forceRefresh && isCacheValid('staff')) {
        return cache.staff.data;
      }

      const result = await dispatch(getFilteredUsers({
        designation: "Office Assistant",
        forceRefresh
      })).unwrap();
      
      setCache('staff', result.users);
      return result.users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get visiting faculties using filtered approach
export const getVFaculties = createAsyncThunk(
  "user/getVFaculties",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      if (!forceRefresh && isCacheValid('vFaculties')) {
        return cache.vFaculties.data;
      }

      const result = await dispatch(getFilteredUsers({
        designation: "Visiting Faculty",
        forceRefresh
      })).unwrap();
      
      setCache('vFaculties', result.users);
      return result.users;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Legacy getAllUsers for backward compatibility
export const getAllUsers = createAsyncThunk(
  "user/getAllUsers",
  async ({ forceRefresh = false } = {}, { rejectWithValue, dispatch }) => {
    try {
      return await dispatch(getAllUsersOptimized({ forceRefresh })).unwrap();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Send reset email
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

// Add user with cache invalidation
export const addUser = createAsyncThunk(
  "user/addUser",
  async ({ userData }, { rejectWithValue }) => {
    try {
      const defaultProfilePic =
        "https://img.freepik.com/free-vector/illustration-businessman_53876-5856.jpg?w=740&t=st=1721141254~exp=1721141854~hmac=16b7be7a26efb621a8073b1e8204f34be34595f0d723d5c8ae9279435c66a468";

      const profilePic = userData.photoURL || defaultProfilePic;
      
      const userDataToSave = {
        ...userData,
        photoURL: profilePic,
        createdAt: Timestamp.now(),
      };

      const userRef = doc(FIREBASE_DB, "users", userData.uid);
      await setDoc(userRef, userDataToSave);
      
      clearCache(); // Clear all cache
      
      return {
        ...userDataToSave,
        id: userData.uid,
        createdAt: convertTimestamp(userDataToSave.createdAt)
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Add degree to user
export const addDegreeToUser = createAsyncThunk(
  "user/addDegreeToUser",
  async (degree, { rejectWithValue }) => {
    try {
      const degreesRef = collection(FIREBASE_DB, "degrees");
      const degreeData = {
        ...degree,
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(degreesRef, degreeData);
      return { 
        id: docRef.id, 
        ...degreeData,
        createdAt: convertTimestamp(degreeData.createdAt)
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Fetch user degrees
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
        return {
          id: doc.id,
          ...data,
          createdAt: convertTimestamp(data.createdAt),
          startYear: data.startYear?.toDate?.()?.getFullYear() || data.startYear,
          endYear: data.endYear?.toDate?.()?.getFullYear() || data.endYear,
        };
      });
      return degrees;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Search users in cached data
export const searchUsers = createAsyncThunk(
  "user/searchUsers",
  async ({ searchTerm, designation = null, field = "username" }, { rejectWithValue, getState, dispatch }) => {
    try {
      const state = getState();
      
      // Ensure we have all users data
      if (!state.user.allUsers.length || !isCacheValid('users')) {
        await dispatch(getAllUsersOptimized()).unwrap();
      }
      
      const updatedState = getState();
      let users = updatedState.user.allUsers;
      
      // Filter by designation if provided
      if (designation) {
        users = users.filter(user => user.designation?.trim() === designation);
      }
      
      // Search in the specified field
      const searchResults = users.filter(user => {
        const fieldValue = user[field]?.toString().toLowerCase() || "";
        return fieldValue.includes(searchTerm.toLowerCase());
      });
      
      return searchResults;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
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
  searchResults: [],
  realtimeListener: null,
  lastFetch: null,
  cacheStatus: 'idle'
};

const userOptimizedSlice = createSlice({
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
      state.staff = [];
      state.allUsers = [];
      state.realtimeData = null;
      state.searchResults = [];
      clearCache(); // Clear all cache on user clear
    },
    setUser(state, action) {
      state.userEmail = action.payload.userEmail;
      state.uid = action.payload.uid;
    },
    updateRealtimeDataFromListener(state, action) {
      state.realtimeData = action.payload;
    },
    setRealtimeListener(state, action) {
      state.realtimeListener = action.payload;
    },
    invalidateCache(state) {
      clearCache();
      state.cacheStatus = 'stale';
    },
    optimisticUserUpdate(state, action) {
      const { uid, userData } = action.payload;
      // Update in allUsers array
      const userIndex = state.allUsers.findIndex(user => user.id === uid);
      if (userIndex !== -1) {
        state.allUsers[userIndex] = { ...state.allUsers[userIndex], ...userData };
      }
      
      // Update in specific arrays
      const updateInArray = (array) => {
        const index = array.findIndex(user => user.id === uid);
        if (index !== -1) {
          array[index] = { ...array[index], ...userData };
        }
      };
      
      updateInArray(state.professors);
      updateInArray(state.students);
      updateInArray(state.staff);
      updateInArray(state.vFaculties);
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Realtime Data
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
      
      // Login User
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
      
      // Get User
      .addCase(getUser.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getUser.fulfilled, (state, action) => {
        state.loading = false;
        Object.assign(state, action.payload);
        state.isLoading = false;
      })
      .addCase(getUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Delete User
      .addCase(deleteUser.fulfilled, (state, action) => {
        const userId = action.payload;
        state.allUsers = state.allUsers.filter(user => user.id !== userId);
        state.professors = state.professors.filter(user => user.id !== userId);
        state.students = state.students.filter(user => user.id !== userId);
        state.staff = state.staff.filter(user => user.id !== userId);
        state.vFaculties = state.vFaculties.filter(user => user.id !== userId);
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isLoading = false;
        const { uid, ...userData } = action.payload;
        
        // Update current user if it matches
        if (state.uid === uid) {
          Object.assign(state, userData);
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Get All Users Optimized
      .addCase(getAllUsersOptimized.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(getAllUsersOptimized.fulfilled, (state, action) => {
        state.loading = false;
        state.allUsers = action.payload;
        state.isLoading = false;
        state.lastFetch = Date.now();
        state.cacheStatus = 'valid';
        
        // Auto-populate other arrays from allUsers
        state.professors = action.payload.filter(user => 
          ["Professor", "Visiting Faculty", "Assistant Professor"].includes(user.designation?.trim())
        );
        state.students = action.payload.filter(user => 
          user.designation?.trim() === "Student"
        );
        state.staff = action.payload.filter(user => 
          user.designation?.trim() === "Office Assistant"
        );
        state.vFaculties = action.payload.filter(user => 
          user.designation?.trim() === "Visiting Faculty"
        );
      })
      .addCase(getAllUsersOptimized.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Get Professors
      .addCase(getProfessors.fulfilled, (state, action) => {
        state.professors = action.payload;
        state.loading = false;
        state.isLoading = false;
      })
      .addCase(getProfessors.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
      })
      .addCase(getProfessors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Get Students
      .addCase(getStudents.fulfilled, (state, action) => {
        state.students = action.payload;
        state.loading = false;
        state.isLoading = false;
      })
      .addCase(getStudents.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
      })
      .addCase(getStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Get Staff
      .addCase(getStaff.fulfilled, (state, action) => {
        state.staff = action.payload;
        state.loading = false;
        state.isLoading = false;
      })
      .addCase(getStaff.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
      })
      .addCase(getStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Get VFaculties
      .addCase(getVFaculties.fulfilled, (state, action) => {
        state.vFaculties = action.payload;
        state.loading = false;
        state.isLoading = false;
      })
      .addCase(getVFaculties.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
      })
      .addCase(getVFaculties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Legacy getAllUsers
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
        state.loading = false;
        state.isLoading = false;
      })
      
      // Add User
      .addCase(addUser.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.isLoading = true;
      })
      .addCase(addUser.fulfilled, (state, action) => {
        state.loading = false;
        state.allUsers.push(action.payload);
        state.isLoading = false;
      })
      .addCase(addUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoading = false;
      })
      
      // Add Degree
      .addCase(addDegreeToUser.fulfilled, (state, action) => {
        state.degrees.push(action.payload);
      })
      .addCase(addDegreeToUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch User Degrees
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
      })
      
      // Batch Upload
      .addCase(batchUploadUserData.fulfilled, (state, action) => {
        state.loading = false;
        // Optionally show results
      })
      
      // Search Users
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchResults = action.payload;
        state.loading = false;
      })
      .addCase(searchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { 
  clearUser, 
  setUser, 
  updateRealtimeDataFromListener,
  setRealtimeListener,
  invalidateCache,
  optimisticUserUpdate
} = userOptimizedSlice.actions;

export default userOptimizedSlice.reducer;
