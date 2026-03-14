# API Service Layer - Phase 3.1

## Overview

This directory contains the API service layer for communicating with the FastAPI backend. The service layer is created but **not yet integrated** with components.

## File: `api.js`

Provides centralized API functions for all backend interactions.

### Features

- ✅ Axios-based HTTP client
- ✅ Base URL configuration (`http://localhost:8000/api`)
- ✅ Centralized error handling with readable messages
- ✅ JSON headers and timeout configuration
- ✅ All Phase 2 backend endpoints covered

### API Functions

#### Group Management
- `getGroups()` - List all user's groups
- `createGroup(data)` - Create a new group
- `joinGroup(inviteCode)` - Join a group with invite code
- `getGroupById(groupId)` - Get group details

#### Expense Management
- `getGroupExpenses(groupId)` - List expenses for a group
- `addExpense(groupId, data)` - Add a new expense

#### Balance Calculation
- `getGroupBalances(groupId)` - Get balance summary

## Current Status

⚠️ **NOT YET USED** - This file is created but not imported or used anywhere in the codebase yet.

Components still use mock data from `lib/mock-data.js`.

## Next Phase (3.2)

In the next phase, components will be updated to:
1. Import API functions: `import * as api from '@/services/api';`
2. Replace mock data calls with API calls
3. Add loading states while API calls are in progress
4. Handle errors gracefully with user-friendly messages
5. Update state when API calls succeed

## Example Integration (Future)

```javascript
// Before (using mock data):
import { mockGroups } from '@/lib/mock-data';
const groups = Object.values(mockGroups);

// After (using API):
import { getGroups } from '@/services/api';

const [groups, setGroups] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await getGroups();
      setGroups(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  fetchGroups();
}, []);
```

## Error Handling

All API functions throw errors with readable messages:
- Network errors: "Unable to connect to server..."
- 404 errors: "Group with ID 'xxx' not found"
- 403 errors: "You are not a member of this group"
- Validation errors: Backend error message from `detail` field

Components should catch these errors and display them to users using toast notifications or error messages.
