// Mock data for the expense splitter app

export const mockUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Mike Johnson', email: 'mike@example.com' },
  { id: 4, name: 'Sarah Wilson', email: 'sarah@example.com' },
  { id: 5, name: 'Alex Brown', email: 'alex@example.com' },
  { id: 6, name: 'Emma Davis', email: 'emma@example.com' }
];

export const mockGroups = [
  {
    id: 1,
    name: 'Weekend Trip',
    description: 'Our annual weekend getaway',
    createdBy: 1,
    members: [1, 2, 3, 4],
    createdAt: '2024-01-01',
    expenses: [
      {
        id: 1,
        title: 'Hotel Booking',
        amount: 450.00,
        paidBy: 1,
        splitBetween: [1, 2, 3, 4],
        date: '2024-01-15',
        category: 'Accommodation',
        description: '2 nights at the beach resort'
      },
      {
        id: 2,
        title: 'Dinner at Restaurant',
        amount: 120.50,
        paidBy: 2,
        splitBetween: [1, 2, 3, 4],
        date: '2024-01-14',
        category: 'Food',
        description: 'Group dinner at the local seafood place'
      }
    ]
  },
  {
    id: 2,
    name: 'Office Lunch',
    description: 'Weekly office lunch group',
    createdBy: 1,
    members: [1, 5, 6],
    createdAt: '2024-01-10',
    expenses: [
      {
        id: 3,
        title: 'Pizza Order',
        amount: 45.00,
        paidBy: 1,
        splitBetween: [1, 5, 6],
        date: '2024-01-12',
        category: 'Food',
        description: 'Friday pizza lunch'
      }
    ]
  },
  {
    id: 3,
    name: 'Roommates',
    description: 'Shared apartment expenses',
    createdBy: 2,
    members: [2, 3],
    createdAt: '2024-01-05',
    expenses: [
      {
        id: 4,
        title: 'Groceries',
        amount: 85.30,
        paidBy: 2,
        splitBetween: [2, 3],
        date: '2024-01-11',
        category: 'Food',
        description: 'Weekly grocery shopping'
      },
      {
        id: 5,
        title: 'Electricity Bill',
        amount: 120.00,
        paidBy: 3,
        splitBetween: [2, 3],
        date: '2024-01-10',
        category: 'Utilities',
        description: 'Monthly electricity bill'
      }
    ]
  }
];

// Helper functions
export const getUserById = (userId) => {
  return mockUsers.find(user => user.id === userId);
};

export const getGroupById = (groupId) => {
  return mockGroups.find(group => group.id === groupId);
};

export const getGroupsByUserId = (userId) => {
  return mockGroups.filter(group => group.members.includes(userId));
};

export const getExpensesByGroupId = (groupId) => {
  const group = getGroupById(groupId);
  return group ? group.expenses : [];
};

export const calculateUserBalance = (userId, groupId) => {
  const group = getGroupById(groupId);
  if (!group) return 0;

  let balance = 0;
  
  group.expenses.forEach(expense => {
    const splitAmount = expense.amount / expense.splitBetween.length;
    
    if (expense.paidBy === userId) {
      // User paid, so they're owed money
      balance += expense.amount - splitAmount;
    } else if (expense.splitBetween.includes(userId)) {
      // User owes money
      balance -= splitAmount;
    }
  });
  
  return balance;
};

