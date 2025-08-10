import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.API_URL ;

// Send authentication email (specifically for admin adding users)
export const sendAuthenticationEmail = createAsyncThunk(
  'email/sendAuthenticationEmail',
  async ({ name, email, password, role = 'Student' }, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/send-email`, {
        name,
        email,
        password,
        role,

      });
      return response.data;
    } catch (error) {
      console.error('Error sending authentication email:', error);
      return thunkAPI.rejectWithValue(
        error.response ? error.response.data : error.message
      );
    }
  }
);

export const sendWelcomeEmail = createAsyncThunk(
  'email/sendWelcomeEmail',
  async ({ name, email, password, role = 'Student' }, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/send-email`, {
        name,
        email,
        password,
        role
      });
      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      return thunkAPI.rejectWithValue(
        error.response ? error.response.data : error.message
      );
    }
  }
);

export const sendUpdationEmail = createAsyncThunk(
  'email/sendUpdationEmail',
  async ({ name, email }, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/send-update-profile-email`, {
        name,
        email,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      return thunkAPI.rejectWithValue(
        error.response ? error.response.data : error.message
      );
    }
  }
);

export const sendUpdatePasswordEmail = createAsyncThunk(
  'email/sendUpdatePasswordEmail',
  async ({ name, email }, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/send-update-password-email`, {
        name,
        email,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      return thunkAPI.rejectWithValue(
        error.response ? error.response.data : error.message
      );
    }
  }
);

// Bulk send emails for multiple users
export const sendBulkAuthenticationEmails = createAsyncThunk(
  'email/sendBulkAuthenticationEmails',
  async (users, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/send-bulk-auth-emails`, {
        users,
        adminEmail: 'admin@college.edu',
        adminName: 'College Administrator'
      });
      return response.data;
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      return thunkAPI.rejectWithValue(
        error.response ? error.response.data : error.message
      );
    }
  }
);

const emailSlice = createSlice({
  name: 'email',
  initialState: {
    status: 'idle',
    message: '',
    isSent: false,
    isSending: false,
    isNotSent: false,
    bulkStatus: 'idle',
    bulkResults: null,
    lastEmailType: null,
    emailHistory: []
  },
  reducers: {
    resetEmailState: (state) => {
      state.status = 'idle';
      state.message = '';
      state.isSent = false;
      state.isSending = false;
      state.isNotSent = false;
      state.lastEmailType = null;
    },
    resetBulkEmailState: (state) => {
      state.bulkStatus = 'idle';
      state.bulkResults = null;
    },
    addToEmailHistory: (state, action) => {
      state.emailHistory.unshift({
        ...action.payload,
        timestamp: new Date().toISOString()
      });
      // Keep only last 50 emails
      if (state.emailHistory.length > 50) {
        state.emailHistory = state.emailHistory.slice(0, 50);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Send Authentication Email
      .addCase(sendAuthenticationEmail.pending, (state) => {
        state.status = 'loading';
        state.isSending = true;
        state.isSent = false;
        state.isNotSent = false;
        state.message = '';
        state.lastEmailType = 'authentication';
      })
      .addCase(sendAuthenticationEmail.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.message = action.payload.message || 'Authentication email sent successfully';
        state.isSending = false;
        state.isSent = true;
        state.isNotSent = false;
      })
      .addCase(sendAuthenticationEmail.rejected, (state, action) => {
        state.status = 'failed';
        state.message = action.payload || 'Failed to send authentication email';
        state.isSending = false;
        state.isSent = false;
        state.isNotSent = true;
      })
      
      // Send Welcome Email
      .addCase(sendWelcomeEmail.pending, (state) => {
        state.status = 'loading';
        state.isSending = true;
        state.isSent = false;
        state.isNotSent = false;
        state.message = '';
        state.lastEmailType = 'welcome';
      })
      .addCase(sendWelcomeEmail.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.message = action.payload.message || 'Welcome email sent successfully';
        state.isSending = false;
        state.isSent = true;
        state.isNotSent = false;
      })
      .addCase(sendWelcomeEmail.rejected, (state, action) => {
        state.status = 'failed';
        state.message = action.payload || 'Failed to send welcome email';
        state.isSending = false;
        state.isSent = false;
        state.isNotSent = true;
      })
      
      // Send Update Email
      .addCase(sendUpdationEmail.pending, (state) => {
        state.status = 'loading';
        state.isSending = true;
        state.lastEmailType = 'update';
      })
      .addCase(sendUpdationEmail.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.message = action.payload.message || 'Update email sent successfully';
        state.isSending = false;
        state.isSent = true;
        state.isNotSent = false;
      })
      .addCase(sendUpdationEmail.rejected, (state, action) => {
        state.status = 'failed';
        state.message = action.payload || 'Failed to send update email';
        state.isSending = false;
        state.isSent = false;
        state.isNotSent = true;
      })
      
      // Send Update Password Email
      .addCase(sendUpdatePasswordEmail.pending, (state) => {
        state.status = 'loading';
        state.isSending = true;
        state.lastEmailType = 'password';
      })
      .addCase(sendUpdatePasswordEmail.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.message = action.payload.message || 'Password update email sent successfully';
        state.isSending = false;
        state.isSent = true;
        state.isNotSent = false;
      })
      .addCase(sendUpdatePasswordEmail.rejected, (state, action) => {
        state.status = 'failed';
        state.message = action.payload || 'Failed to send password update email';
        state.isSending = false;
        state.isSent = false;
        state.isNotSent = true;
      })
      
      // Bulk Email Operations
      .addCase(sendBulkAuthenticationEmails.pending, (state) => {
        state.bulkStatus = 'loading';
      })
      .addCase(sendBulkAuthenticationEmails.fulfilled, (state, action) => {
        state.bulkStatus = 'succeeded';
        state.bulkResults = action.payload;
      })
      .addCase(sendBulkAuthenticationEmails.rejected, (state, action) => {
        state.bulkStatus = 'failed';
        state.message = action.payload || 'Failed to send bulk emails';
      });
  },
});

export const { 
  resetEmailState, 
  resetBulkEmailState, 
  addToEmailHistory 
} = emailSlice.actions;

export default emailSlice.reducer;
