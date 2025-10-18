const admin = require('firebase-admin');

const db = admin.firestore();

const COLLECTIONS = {
  USERS: 'users',
  STAFF: 'staff',
  CHIT_GROUPS: 'chitGroups',
  CHIT_SUBSCRIPTIONS: 'chitSubscriptions',
  AUCTIONS: 'auctions',
  LOAN_APPLICATIONS: 'loanApplications',
  PAYMENTS: 'payments',
  STAFF_TASKS: 'staffTasks',
  AI_ALERTS: 'aiAlerts',
};

function getCollectionRef(name) {
  return db.collection(name);
}

module.exports = { db, COLLECTIONS, getCollectionRef };
