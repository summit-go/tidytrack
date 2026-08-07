// Role helpers and billing visibility gates — keep central so we never drift.
//
// Staff money: canSeeMoney(employee) — owner always; leads/managers only with
// view_pay_info capability (owner toggles in EmployeeForm).
//
// Portal invoices: canSeePortalInvoices(portalUser) — per-user can_view_invoices
// opt-in (owner toggles in PortalUserForm; default off for all portal kinds).
// Previewing owner (portalUser.__preview) always sees invoices. Not kind-based.

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

/** Staff Money tab, pay rates, shift billing — owner or view_pay_info capability. */
export const canSeeMoney = (e) => isOwner(e) || can(e, 'view_pay_info');

/** Portal Invoices tab — per-user opt-in or owner preview session. */
export const canSeePortalInvoices = (portalUser) =>
  !!portalUser?.can_view_invoices || !!portalUser?.__preview;

// The beta apartment complex (any property with "beta" in its name) is
// only visible to owners and granted beta testers — everyone else has
// it filtered out of property lists, like the other beta-gated things.
export const visibleProps = (list, employee) => {
  if (!Array.isArray(list)) return list || [];
  if (employee?.is_beta_tester || employee?.role === 'owner') return list;
  return list.filter(c => !/\bbeta\b/i.test(c?.name || ''));
};
