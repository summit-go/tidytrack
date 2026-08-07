// Role helpers — keep this central so we never drift
export const isOwner   = (e) => e?.role === 'owner';
export const isManager = (e) => e?.role === 'manager' || e?.role === 'owner';

// Returns true if the employee has the given capability key.
// Owners always return true. Manager defaults are set at create time
// in the EmployeeForm. Missing keys default to false.
export const can = (employee, capabilityKey) => {
  if (!employee) return false;
  if (employee.role === 'owner') return true;
  const r = employee.responsibilities;
  if (r && typeof r === 'object' && r[capabilityKey] === true) return true;
  return false;
};

export const canSeeMoney = (e) => isOwner(e) || can(e, 'view_pay_info'); // managers see $ if toggled on; owners always

// The beta apartment complex (any property with "beta" in its name) is
// only visible to owners and granted beta testers — everyone else has
// it filtered out of property lists, like the other beta-gated things.
export const visibleProps = (list, employee) => {
  if (!Array.isArray(list)) return list || [];
  if (employee?.is_beta_tester || employee?.role === 'owner') return list;
  return list.filter(c => !/\bbeta\b/i.test(c?.name || ''));
};
