// Role helpers and billing visibility gates — keep central so we never drift.
//
// Staff money: canSeeMoney(employee) — owner always; leads only with
// view_pay_info capability (owner toggles in EmployeeForm).
//
// Portal invoices: canSeePortalInvoices(portalUser) — per-user can_view_invoices
// opt-in (owner toggles in PortalUserForm; default off for all portal kinds).
// Previewing owner (portalUser.__preview) always sees invoices. Not kind-based.

/** Canonical employee.role values (see mvp.md — "Lead" is internal staff admin). */
export const ROLE_EMPLOYEE = "employee";
export const ROLE_LEAD = "lead";
export const ROLE_OWNER = "owner";
export const ROLE_LEGACY_MANAGER =
  "manager"; /** Stored in employees.role for internal Lead — UI says "Lead". */

/** All roles stored in employees.role — include legacy for PostgREST filters. */
export const EMPLOYEE_ROLES = [
  ROLE_EMPLOYEE,
  ROLE_LEAD,
  ROLE_OWNER,
  ROLE_LEGACY_MANAGER,
];

/** Roles assignable in EmployeeForm (no legacy write). */
export const ASSIGNABLE_EMPLOYEE_ROLES = [ROLE_EMPLOYEE, ROLE_LEAD, ROLE_OWNER];

/** Lead + employee — typical assignee picker filter. */
export const FIELD_STAFF_ROLES = [
  ROLE_EMPLOYEE,
  ROLE_LEAD,
  ROLE_LEGACY_MANAGER,
];

export const isLeadRole = (role) =>
  role === ROLE_LEAD || role === ROLE_LEGACY_MANAGER;

export const isOwner = (e) => e?.role === ROLE_OWNER;

/** Owner or lead (legacy manager rows included). Formerly isManager. */
export const isLead = (e) => isLeadRole(e?.role) || isOwner(e);

/** Lead only — not owner. */
export const isLeadOnly = (e) => isLeadRole(e?.role);

export const isLeadOrOwnerRole = (role) =>
  role === ROLE_OWNER || isLeadRole(role);

/** Map DB role to form/UI value (manager → lead alias). */
export const normalizeRole = (role) =>
  role === ROLE_LEGACY_MANAGER ? ROLE_LEAD : role;

/** Persisted employees.role — Lead always stored as manager. */
export const roleForDb = (role) => {
  if (role === ROLE_OWNER) return ROLE_OWNER;
  if (isLeadRole(role)) return ROLE_LEGACY_MANAGER;
  return role ?? ROLE_EMPLOYEE;
};

export const roleLabel = (role) => {
  const r = normalizeRole(role);
  if (r === ROLE_OWNER) return "Owner";
  if (r === ROLE_LEAD) return "Lead";
  return "Employee";
};

/** @deprecated Use isLead — alias kept for any external references during transition. */
export const isManager = isLead;

// Returns true if the employee has the given capability key.
// Owners always return true. Lead defaults are set at create time
// in the EmployeeForm. Missing keys default to false.
export const can = (employee, capabilityKey) => {
  if (!employee) return false;
  if (employee.role === ROLE_OWNER) return true;
  const r = employee.responsibilities;
  if (r && typeof r === "object" && r[capabilityKey] === true) return true;
  return false;
};

/** Staff Money tab, pay rates, shift billing — owner or view_pay_info capability. */
export const canSeeMoney = (e) => isOwner(e) || can(e, "view_pay_info");

/** Portal Invoices tab — per-user opt-in or owner preview session. */
export const canSeePortalInvoices = (portalUser) =>
  !!portalUser?.can_view_invoices || !!portalUser?.__preview;

/** One-time localStorage migration: manager_* page keys → lead_* (Track 4). */
export const migrateLeadPersistenceKeys = (employeeId) => {
  if (!employeeId) return;
  const pairs = [
    [`manager_tab_${employeeId}`, `lead_tab_${employeeId}`],
    [
      `manager_preview_cleaner_${employeeId}`,
      `lead_preview_cleaner_${employeeId}`,
    ],
    [`manager_mode_${employeeId}`, `lead_mode_${employeeId}`],
    [`manager_preview_pm_${employeeId}`, `lead_preview_pm_${employeeId}`],
  ];
  try {
    for (const [oldKey, newKey] of pairs) {
      const fullOld = `tidytrack_page_${oldKey}`;
      const fullNew = `tidytrack_page_${newKey}`;
      const val = localStorage.getItem(fullOld);
      if (val != null && localStorage.getItem(fullNew) == null) {
        localStorage.setItem(fullNew, val);
      }
      if (val != null) localStorage.removeItem(fullOld);
    }
  } catch {}
};

// The beta apartment complex (any property with "beta" in its name) is
// only visible to owners and granted beta testers — everyone else has
// it filtered out of property lists, like the other beta-gated things.
export const visibleProps = (list, employee) => {
  if (!Array.isArray(list)) return list || [];
  if (employee?.is_beta_tester || employee?.role === ROLE_OWNER) return list;
  return list.filter((c) => !/\bbeta\b/i.test(c?.name || ""));
};
