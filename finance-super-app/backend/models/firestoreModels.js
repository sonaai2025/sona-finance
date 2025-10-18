const { getFirestore } = require('../services/firebaseService');

class FirestoreModel {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  async create(data) {
    try {
      const db = getFirestore();
      const docRef = await db.collection(this.collectionName).add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      throw new Error(`Error creating document in ${this.collectionName}: ${error.message}`);
    }
  }

  async getById(id) {
    try {
      const db = getFirestore();
      const doc = await db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error getting document from ${this.collectionName}: ${error.message}`);
    }
  }

  async getAll(filters = {}, orderBy = null, limit = null) {
    try {
      const db = getFirestore();
      let query = db.collection(this.collectionName);

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        query = query.where(field, '==', value);
      });

      // Apply ordering
      if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error getting documents from ${this.collectionName}: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      const db = getFirestore();
      await db.collection(this.collectionName).doc(id).update({
        ...data,
        updatedAt: new Date()
      });
      return { id, ...data };
    } catch (error) {
      throw new Error(`Error updating document in ${this.collectionName}: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      const db = getFirestore();
      await db.collection(this.collectionName).doc(id).delete();
      return { id, deleted: true };
    } catch (error) {
      throw new Error(`Error deleting document from ${this.collectionName}: ${error.message}`);
    }
  }

  async getByField(field, value) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(this.collectionName)
        .where(field, '==', value)
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error getting documents by field from ${this.collectionName}: ${error.message}`);
    }
  }

  async getByMultipleFields(filters) {
    try {
      const db = getFirestore();
      let query = db.collection(this.collectionName);

      Object.entries(filters).forEach(([field, value]) => {
        query = query.where(field, '==', value);
      });

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error getting documents by multiple fields from ${this.collectionName}: ${error.message}`);
    }
  }
}

// Specific model classes with custom methods
class UserModel extends FirestoreModel {
  constructor() {
    super('users');
  }

  async getByEmail(email) {
    return this.getByField('email', email);
  }

  async updateTrustScore(userId, score) {
    return this.update(userId, { trustScore: score });
  }

  async getUsersByTrustScore(minScore = 0) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(this.collectionName)
        .where('trustScore', '>=', minScore)
        .orderBy('trustScore', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error getting users by trust score: ${error.message}`);
    }
  }
}

class StaffModel extends FirestoreModel {
  constructor() {
    super('staff');
  }

  async getByRole(role) {
    return this.getByField('role', role);
  }

  async getActiveStaff() {
    return this.getByField('isActive', true);
  }

  async updatePerformanceScore(staffId, score) {
    return this.update(staffId, { performanceScore: score });
  }
}

class ChitGroupModel extends FirestoreModel {
  constructor() {
    super('chitGroups');
  }

  async getActiveGroups() {
    return this.getByField('status', 'Active');
  }

  async getUpcomingGroups() {
    return this.getByField('status', 'Upcoming');
  }

  async updateStatus(groupId, status) {
    return this.update(groupId, { status });
  }

  async getGroupsByStatus(status) {
    return this.getByField('status', status);
  }
}

class ChitSubscriptionModel extends FirestoreModel {
  constructor() {
    super('chitSubscriptions');
  }

  async getByGroupId(groupId) {
    return this.getByField('groupId', groupId);
  }

  async getByUserId(userId) {
    return this.getByField('userId', userId);
  }

  async getWinners() {
    return this.getByField('isWinner', true);
  }
}

class AuctionModel extends FirestoreModel {
  constructor() {
    super('auctions');
  }

  async getByGroupId(groupId) {
    return this.getByField('groupId', groupId);
  }

  async getByGroupAndMonth(groupId, month) {
    return this.getByMultipleFields({ groupId, auctionMonth: month });
  }
}

class LoanApplicationModel extends FirestoreModel {
  constructor() {
    super('loanApplications');
  }

  async getByUserId(userId) {
    return this.getByField('userId', userId);
  }

  async getByStatus(status) {
    return this.getByField('status', status);
  }

  async getPendingApplications() {
    return this.getByField('status', 'Pending');
  }

  async getApprovedApplications() {
    return this.getByField('status', 'Approved');
  }
}

class PaymentModel extends FirestoreModel {
  constructor() {
    super('payments');
  }

  async getByUserId(userId) {
    return this.getByField('userId', userId);
  }

  async getByDateRange(startDate, endDate) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(this.collectionName)
        .where('paymentDate', '>=', startDate)
        .where('paymentDate', '<=', endDate)
        .orderBy('paymentDate', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error getting payments by date range: ${error.message}`);
    }
  }

  async getDailyPayments(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getByDateRange(startOfDay, endOfDay);
  }

  async getByPaymentFor(paymentFor) {
    return this.getByField('paymentFor', paymentFor);
  }
}

module.exports = {
  FirestoreModel,
  UserModel,
  StaffModel,
  ChitGroupModel,
  ChitSubscriptionModel,
  AuctionModel,
  LoanApplicationModel,
  PaymentModel
};