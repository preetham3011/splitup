/**
 * splitUP Frontend API Service Layer
 * 
 * This module provides a centralized API client for communicating with the FastAPI backend.
 * It handles all HTTP requests, error handling, and data transformation.
 * 
 * Current Phase: 3.1 - API Service Layer (Not yet integrated with components)
 * 
 * Usage (future):
 *   import * as api from '@/services/api';
 *   
 *   // Get user's groups
 *   const groups = await api.getGroups();
 *   
 *   // Create a new group
 *   const newGroup = await api.createGroup({ name: "Trip 2024", type: "trip" });
 *   
 *   // Join a group
 *   await api.joinGroup("X8J2-9K");
 * 
 * Note: This service layer is created but not yet used. Components will be updated
 * in the next phase to replace mock data with these API calls.
 */

import axios from 'axios';

// Base URL for the FastAPI backend
// In production, this should come from environment variables
const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor to attach Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('splitup_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth state
      localStorage.removeItem('splitup_token');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Centralized error handler for API responses
 * Transforms API errors into readable messages
 */
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status (4xx, 5xx)
    const { status, data } = error.response;
    const message = data?.detail || data?.message || `Request failed with status ${status}`;
    
    throw new Error(message);
  } else if (error.request) {
    // Request was made but no response received (network error, server down)
    throw new Error('Unable to connect to server. Please check if the backend is running.');
  } else {
    // Something else happened
    throw new Error(error.message || 'An unexpected error occurred');
  }
};

// ============================================================================
// GROUP MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * Get all groups where the current user is a member
 * 
 * @returns {Promise<Array>} Array of group objects
 * @throws {Error} If request fails
 */
export const getGroups = async () => {
  try {
    const response = await apiClient.get('/groups');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Create a new group
 * 
 * @param {Object} data - Group creation data
 * @param {string} data.name - Group name (required)
 * @param {string} data.type - Group type: "home" | "trip" | "couple" | "other" (default: "other")
 * @param {string} data.currency - Currency code (default: "INR")
 * @param {boolean} data.simplify_debts - Enable debt simplification (default: true)
 * @returns {Promise<Object>} Created group object with invite_code
 * @throws {Error} If request fails
 * 
 * @example
 * const group = await createGroup({
 *   name: "Apartment 402",
 *   type: "home",
 *   currency: "INR"
 * });
 */
export const createGroup = async (data) => {
  try {
    const response = await apiClient.post('/groups', data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Join a group using an invite code
 * 
 * @param {string} inviteCode - Group invite code (e.g., "X8J2-9K")
 * @returns {Promise<Object>} Group object that was joined
 * @throws {Error} If invite code is invalid or user is already a member
 * 
 * @example
 * const group = await joinGroup("X8J2-9K");
 */
export const joinGroup = async (inviteCode) => {
  try {
    const response = await apiClient.post('/groups/join', { invite_code: inviteCode });
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Get group details by group ID
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Group object with members and details
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const group = await getGroupById("group_1234");
 */
export const getGroupById = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// EXPENSE MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * Get all expenses for a group
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Array of expense objects
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const expenses = await getGroupExpenses("group_1234");
 */
export const getGroupExpenses = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/expenses`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Add a new expense to a group
 * 
 * @param {string} groupId - Group ID
 * @param {Object} data - Expense creation data
 * @param {string} data.title - Expense title/description (required)
 * @param {number} data.amount - Total amount (required, must be > 0)
 * @param {string} data.paid_by - User ID of person who paid (required)
 * @param {string} data.category - Expense category (default: "Other")
 * @param {string} data.split_type - Split type, currently only "equal" supported (default: "equal")
 * @param {string|Date} data.date - Date of expense (ISO string or Date object, defaults to now)
 * @returns {Promise<Object>} Created expense object with split details
 * @throws {Error} If validation fails or user is not a group member
 * 
 * @example
 * const expense = await addExpense("group_1234", {
 *   title: "Dinner at SpiceHub",
 *   amount: 1200.0,
 *   paid_by: "user_123",
 *   category: "Food",
 *   split_type: "equal"
 * });
 */
export const addExpense = async (groupId, data) => {
  try {
    // Convert date to ISO string if it's a Date object
    const expenseData = {
      ...data,
      date: data.date instanceof Date ? data.date.toISOString() : data.date,
    };
    
    const response = await apiClient.post(`/groups/${groupId}/expenses`, expenseData);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Delete an expense from a group
 * 
 * @param {string} groupId - Group ID
 * @param {string} expenseId - Expense ID to delete
 * @returns {Promise<Object>} Response with success status and updated balances
 * @throws {Error} If expense doesn't exist or user is not a group member
 * 
 * @example
 * const result = await deleteExpense("group_1234", "expense_12345");
 * // Returns: { success: true, expense_id: "expense_12345", balances: {...} }
 */
export const deleteExpense = async (groupId, expenseId) => {
  try {
    const response = await apiClient.delete(`/groups/${groupId}/expenses/${expenseId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// BALANCE CALCULATION API FUNCTIONS
// ============================================================================

/**
 * Get balance summary for the current user in a group
 * 
 * Calculates balances based on all expenses in the group:
 * - your_balance: Net balance (positive = you are owed, negative = you owe)
 * - you_owe: Total amount you owe to others
 * - you_are_owed: Total amount others owe you
 * - people_you_owe: List of people you owe money to
 * - people_who_owe_you: List of people who owe you money
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Balance summary object
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const balances = await getGroupBalances("group_1234");
 * // Returns: {
 * //   group_id: "group_1234",
 * //   your_balance: -800.0,
 * //   you_owe: 1250.0,
 * //   you_are_owed: 450.0,
 * //   people_you_owe: [{ user_id: "...", name: "...", amount: 1250.0 }],
 * //   people_who_owe_you: [{ user_id: "...", name: "...", amount: 450.0 }]
 * // }
 */
export const getGroupBalances = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/balances`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Get settlement suggestions for a group
 * 
 * Calculates minimum transactions needed to settle all balances in the group
 * using a greedy algorithm. These are SUGGESTIONS only - they don't modify data.
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Settlement suggestions object
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const data = await getSettlements("group_1234");
 * // Returns: {
 * //   group_id: "group_1234",
 * //   settlements: [
 * //     { from: "user_456", from_name: "Bob", to: "user_123", to_name: "Alice", amount: 250.0 }
 * //   ],
 * //   total_transactions: 1
 * // }
 */
export const getSettlements = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/balances/settlements`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Record a settlement transaction
 * 
 * IMPORTANT: Settlements are NOT expenses. They resolve debt created by expenses.
 * They do NOT affect total spent or budgets.
 * 
 * @param {string} groupId - Group ID
 * @param {Object} data - Settlement data
 * @param {string} data.from - User ID of debtor (person who owed)
 * @param {string} data.to - User ID of creditor (person who was owed)
 * @param {number} data.amount - Amount being settled
 * @returns {Promise<Object>} Response with updated balances
 * @throws {Error} If validation fails or user is not a member
 * 
 * @example
 * const result = await recordSettlement("group_1234", {
 *   from: "user_456",
 *   to: "user_123",
 *   amount: 250.0
 * });
 * // Returns: { success: true, settlement_id: "...", balances: {...} }
 */
export const recordSettlement = async (groupId, data) => {
  try {
    const response = await apiClient.post(`/groups/${groupId}/balances/settlements`, data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// DASHBOARD & STATS API FUNCTIONS
// ============================================================================

/**
 * Get global dashboard statistics for the current user
 * 
 * Returns aggregated stats across all groups:
 * - groups_count: Number of groups user belongs to
 * - total_spent: Total spent across all groups (expenses only, excludes settlements)
 * - you_owe: Sum of negative balances (absolute value)
 * - you_are_owed: Sum of positive balances
 * 
 * @returns {Promise<Object>} Dashboard statistics
 * @throws {Error} If request fails
 * 
 * @example
 * const stats = await getDashboardStats();
 * // Returns: {
 * //   groups_count: 3,
 * //   total_spent: 12500.0,
 * //   you_owe: 800.0,
 * //   you_are_owed: 450.0
 * // }
 */
export const getDashboardStats = async () => {
  try {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Get all groups with balance and spending info for dashboard cards
 * 
 * @returns {Promise<Array>} Array of groups with balance info
 * @throws {Error} If request fails
 * 
 * @example
 * const groups = await getDashboardGroups();
 * // Returns: [
 * //   {
 * //     group_id: "group_1234",
 * //     name: "Trip 2024",
 * //     type: "trip",
 * //     your_balance: -250.0,
 * //     total_spent: 5000.0,
 * //     member_count: 3
 * //   }
 * // ]
 */
export const getDashboardGroups = async () => {
  try {
    const response = await apiClient.get('/dashboard/groups');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Get statistics for a specific group
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Group statistics
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const stats = await getGroupStats("group_1234");
 * // Returns: {
 * //   total_spent: 5000.0,
 * //   your_balance: -250.0,
 * //   budget_used: 3200.0,
 * //   budget_limit: 5000.0,
 * //   budget_percent: 64.0
 * // }
 */
export const getGroupStats = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/stats`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// BUDGET MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * Get all budgets for a group with spent/remaining/percentage_used
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Array of budget objects with calculated fields
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const budgets = await getGroupBudgets("group_1234");
 * // Returns: [
 * //   {
 * //     id: "budget_12345",
 * //     group_id: "group_1234",
 * //     category: "Food",
 * //     limit: 5000.0,
 * //     spent: 3200.0,
 * //     remaining: 1800.0,
 * //     percentage_used: 64.0,
 * //     created_at: "2024-01-15T10:00:00",
 * //     updated_at: "2024-01-15T10:00:00"
 * //   }
 * // ]
 */
export const getGroupBudgets = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/budgets`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Create or update a budget for a group
 * 
 * @param {string} groupId - Group ID
 * @param {Object} data - Budget creation data
 * @param {string} data.category - Budget category name (required)
 * @param {number} data.limit - Spending limit for this category (required, must be > 0)
 * @returns {Promise<Object>} Created/updated budget object
 * @throws {Error} If validation fails or user is not a group member
 * 
 * @example
 * const budget = await createOrUpdateBudget("group_1234", {
 *   category: "Food",
 *   limit: 5000.0
 * });
 */
export const createOrUpdateBudget = async (groupId, data) => {
  try {
    const response = await apiClient.post(`/groups/${groupId}/budgets`, data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Update an existing budget
 * 
 * @param {string} budgetId - Budget ID
 * @param {Object} data - Budget update data
 * @param {string} data.category - Budget category name (required)
 * @param {number} data.limit - Spending limit for this category (required, must be > 0)
 * @returns {Promise<Object>} Updated budget object
 * @throws {Error} If validation fails or budget doesn't exist
 * 
 * @example
 * const budget = await updateBudget("budget_12345", {
 *   category: "Food",
 *   limit: 6000.0
 * });
 */
export const updateBudget = async (budgetId, data) => {
  try {
    const response = await apiClient.put(`/budgets/${budgetId}`, data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Delete a budget by ID
 * 
 * @param {string} budgetId - Budget ID
 * @returns {Promise<Object>} Success response: { success: true }
 * @throws {Error} If budget doesn't exist or deletion fails
 * 
 * @example
 * await deleteBudget("budget_12345");
 */
export const deleteBudget = async (budgetId) => {
  try {
    const response = await apiClient.delete(`/budgets/${budgetId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// MEMBERS & GROUP MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * Get all members for a group
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Array of member objects with user_id, name, email
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * const members = await getGroupMembers("group_1234");
 * // Returns: [
 * //   { user_id: "user_123", name: "Akshaya", email: "akshaya@edu.in" }
 * // ]
 */
export const getGroupMembers = async (groupId) => {
  try {
    const response = await apiClient.get(`/groups/${groupId}/members`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Update group name
 * 
 * @param {string} groupId - Group ID
 * @param {Object} data - Update data
 * @param {string} data.name - New group name (required)
 * @returns {Promise<Object>} Updated group object
 * @throws {Error} If validation fails or user is not a group member
 * 
 * @example
 * const group = await updateGroup("group_1234", { name: "New Group Name" });
 */
export const updateGroup = async (groupId, data) => {
  try {
    const response = await apiClient.put(`/groups/${groupId}`, data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Delete a group and all related data
 * 
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Success response: { success: true }
 * @throws {Error} If group doesn't exist or user is not a member
 * 
 * @example
 * await deleteGroup("group_1234");
 */
export const deleteGroup = async (groupId) => {
  try {
    const response = await apiClient.delete(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Get activity feed for current user across all groups
 * 
 * @returns {Promise<Object>} Activity feed with activities array
 * @throws {Error} If request fails
 * 
 * @example
 * const data = await getActivity();
 * // Returns: {
 * //   activities: [
 * //     { type: "expense", message: "You added ₹500...", created_at: "...", amount: 500 },
 * //     { type: "settlement", message: "Bob settled ₹250...", created_at: "...", amount: 250 }
 * //   ],
 * //   total: 2
 * // }
 */
export const getActivity = async () => {
  try {
    const response = await apiClient.get('/activity');
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// ============================================================================
// EXPORT DEFAULT (for convenience)
// ============================================================================

/**
 * Default export with all API functions
 * This allows importing as: import api from '@/services/api';
 */
export default {
  // Groups
  getGroups,
  createGroup,
  joinGroup,
  getGroupById,
  
  // Expenses
  getGroupExpenses,
  addExpense,
  deleteExpense,
  
  // Balances
  getGroupBalances,
  getSettlements,
  recordSettlement,
  
  // Dashboard & Stats
  getDashboardStats,
  getDashboardGroups,
  getGroupStats,
  
  // Budgets
  getGroupBudgets,
  createOrUpdateBudget,
  updateBudget,
  deleteBudget,
  
  // Members & Group Management
  getGroupMembers,
  updateGroup,
  deleteGroup,
  
  // Activity
  getActivity,
};
