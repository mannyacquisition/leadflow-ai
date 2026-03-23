/**
 * Stub Base44 client - prevents errors from legacy pages
 * These pages need to be migrated to use the new API client
 */

const noop = () => Promise.resolve([]);
const noopObj = () => Promise.resolve({});

const stubEntity = {
  list: noop,
  create: noopObj,
  update: noopObj,
  delete: noop,
  subscribe: () => () => {},
};

export const base44 = {
  auth: {
    me: () => Promise.reject(new Error('Use AuthProvider instead')),
  },
  entities: {
    Lead: stubEntity,
    Campaign: stubEntity,
    Message: stubEntity,
    OrganizationSettings: stubEntity,
    SystemHealthLog: stubEntity,
    DailyInsight: stubEntity,
    User: stubEntity,
  },
  functions: {
    invoke: (name, params) => {
      console.warn(`[Base44 Stub] Function ${name} called but not implemented. Use new API.`);
      return Promise.resolve({});
    },
  },
  users: {
    inviteUser: noop,
  },
};

export default base44;
