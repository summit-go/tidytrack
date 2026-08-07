// Quick assignment clean types — for properties without full bedroom/template setup.
export const QUICK_TYPES = [
  { key: "standard", label: "Standard" },
  { key: "deep", label: "Deep clean" },
  { key: "move_out_check", label: "Move-out" },
  { key: "cleaning_check", label: "Cleaning check" },
  { key: "reclean", label: "Re-clean" },
  { key: "trash_out", label: "Trash out" },
];

// The set of assignment types PMs can pick from when uploading.
// Owners/managers can change the type when approving.
export const ASSIGNMENT_TYPES = [
  {
    value: "cleaning_check",
    label: "Cleaning check",
    short: "Cleaning check",
    color: "bg-sky-100 text-sky-800 border-sky-300",
  },
  {
    value: "deep",
    label: "Deep clean",
    short: "Deep clean",
    color: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    value: "move_out_check",
    label: "Move out",
    short: "Move out",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  {
    value: "reclean",
    label: "Reclean",
    short: "Reclean",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  {
    value: "trash_out",
    label: "Trash out",
    short: "Trash out",
    color: "bg-lime-100 text-lime-800 border-lime-300",
  },
  {
    value: "standard",
    label: "Standard clean",
    short: "Standard clean",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
];
export const assignmentTypeLabel = (value) =>
  ASSIGNMENT_TYPES.find((t) => t.value === value)?.label || value || "";

// App version — shown in the header. Bump per ai/notes/2026-08-07_semantic-versioning.md
// before each deploy (patch = bug fix, minor = new feature, major = breaking change).
export const APP_VERSION = "1.6.0";
export const assignmentTypeMeta = (value) =>
  ASSIGNMENT_TYPES.find((t) => t.value === value) || null;

export const KIND_CANNOT = "cannot_clean";
export const PHOTO_KIND_LABELS = {
  before: "Before",
  after: "After",
  damage: "Damage",
  [KIND_CANNOT]: "Couldn't clean",
};
export const photoKindLabel = (k) => PHOTO_KIND_LABELS[k] || k || "Other";
// Kinds that represent a problem someone has to see and clear.
export const FLAG_KINDS = ["damage", KIND_CANNOT];

export const ASSIGNMENT_MAX_SIZE_MB = 20; // sanity cap on upload size

// =================================================================
// CAPABILITIES — per-employee feature toggles.
// Owners always have every capability. For others, the value comes
// from employees.responsibilities jsonb. See v19 migration.
// =================================================================
export const CAPABILITIES = [
  {
    key: "upload_assignments",
    label: "Upload assignments",
    hint: "Create assignments and upload PDFs or photos for cleaners.",
  },
  {
    key: "approve_pm_assignments",
    label: "Approve PM assignments",
    hint: "Accept or reject assignments submitted by property managers.",
  },
  {
    key: "mark_assignments_done",
    label: "Mark any assignment done",
    hint: "Mark assignments complete even when they did not personally work on them. Without this, an employee can only mark Done on assignments they started.",
  },
  {
    key: "edit_shift_times",
    label: "Edit shift times",
    hint: "Manually adjust clock-in/out and work block times.",
  },
  {
    key: "view_pay_info",
    label: "View pay info",
    hint: "See bill rates, money amounts, and invoices.",
  },
  {
    key: "manage_units",
    label: "Manage units & properties",
    hint: "Add or edit units, parties, properties, and bulk imports.",
  },
  {
    key: "manage_assignments_admin",
    label: "Reassign & delete assignments",
    hint: "Move assignments between bedrooms or delete them entirely.",
  },
  {
    key: "edit_due_dates",
    label: "Change due dates",
    hint: "Tap an assignment\u2019s date to reschedule when it\u2019s due.",
  },
  {
    key: "assign_cleaners",
    label: "Assign cleaners to jobs",
    hint: "Choose who works a cleaning, and approve cleaner requests.",
  },
  {
    key: "view_submission_timeline",
    label: "See submission timeline",
    hint: "On the date pill, see when an assignment was submitted (finished), accepted (PM-approved), and its due date.",
  },
];

// =================================================================
// TASK CATEGORIES — structured picker for cleaners. Coexists with
// freeform task names. Each task has both a category (e.g. "general")
// and an optional subcategory (e.g. "kitchen_area"). Order here is
// preserved in the picker UI.
//
// PM portal groups "By section" on category for clean breakdown.
// =================================================================
export const TASK_CATEGORIES = [
  { id: "bedroom", label: "Bedroom", subcategories: null },
  { id: "bathroom", label: "Bathroom", subcategories: null },
  { id: "vanity", label: "Vanity", subcategories: null },
  // General is split into the 4 inspection-sheet groups (A/B/C/D)
  // that exist on the paper Carriage Cove White-Glove form — each
  // bedroom's sheet has its OWN General section, so a 4-bedroom unit
  // covers all 4 variants between roommates. Items inside a group
  // can be multi-selected and will collapse into a single combined
  // task at submit (see startTasksFromPicker).
  //
  //   A — Bedroom 1 sheet: Living Room, Patio, Water Heater Closet
  //   B — Bedroom 2 sheet: Refrigerator, Freezer, Microwave, Breezeway
  //   C — Bedroom 3 sheet: Hallway Vents, Stove, Oven, Dishwasher
  //   D — Bedroom 4 sheet: Kitchen Area
  {
    id: "general",
    label: "General",
    subcategories: [
      // Group A — Living Room / Patio / Water Heater
      {
        id: "living_room",
        label: "Living room",
        group: "a",
        groupLabel: "LR / Patio / Water Heater",
      },
      {
        id: "patio",
        label: "Patio",
        group: "a",
        groupLabel: "LR / Patio / Water Heater",
      },
      {
        id: "water_heater",
        label: "Water heater",
        group: "a",
        groupLabel: "LR / Patio / Water Heater",
      },
      {
        id: "hallways",
        label: "Hallway",
        group: "a",
        groupLabel: "LR / Patio / Water Heater",
      },
      // Group B — Refrigerator / Freezer / Microwave / Breezeway
      {
        id: "refrigerator",
        label: "Refrigerator",
        group: "b",
        groupLabel: "Fridge / Microwave / Breezeway",
      },
      {
        id: "freezer",
        label: "Freezer",
        group: "b",
        groupLabel: "Fridge / Microwave / Breezeway",
      },
      {
        id: "microwave",
        label: "Microwave",
        group: "b",
        groupLabel: "Fridge / Microwave / Breezeway",
      },
      {
        id: "breezeway",
        label: "Breezeway",
        group: "b",
        groupLabel: "Fridge / Microwave / Breezeway",
      },
      // Group C — Hallway Vents / Stove / Oven / Dishwasher
      {
        id: "vents",
        label: "Hallway vents",
        group: "c",
        groupLabel: "Vents / Stove / Oven / Dishwasher",
      },
      {
        id: "stove",
        label: "Stove",
        group: "c",
        groupLabel: "Vents / Stove / Oven / Dishwasher",
      },
      {
        id: "oven",
        label: "Oven",
        group: "c",
        groupLabel: "Vents / Stove / Oven / Dishwasher",
      },
      {
        id: "dishwasher",
        label: "Dishwasher",
        group: "c",
        groupLabel: "Vents / Stove / Oven / Dishwasher",
      },
      // Group D — Kitchen
      { id: "kitchen", label: "Kitchen", group: "d", groupLabel: "Kitchen" },
    ],
  },
];

// Ordered list of General group keys, used so the UI renders them
// consistently (A → D) regardless of insertion order above.
export const GENERAL_GROUP_ORDER = ["a", "b", "c", "d"];

// Look up a friendly label for category/subcategory ids
export const taskCategoryLabel = (category, subcategory) => {
  if (!category) return null;
  const cat = TASK_CATEGORIES.find((c) => c.id === category);
  if (!cat) return category;
  if (!subcategory) return cat.label;
  const sub = cat.subcategories?.find((s) => s.id === subcategory);
  return sub ? `${cat.label} — ${sub.label}` : cat.label;
};

// Short label for compact display (PM "By section" chips)
export const taskCategoryShortLabel = (category, subcategory) => {
  if (!category) return null;
  const cat = TASK_CATEGORIES.find((c) => c.id === category);
  if (!cat) return category;
  if (category === "general" && subcategory) {
    const sub = cat.subcategories?.find((s) => s.id === subcategory);
    return sub ? `General — ${sub.label}` : "General";
  }
  return cat.label;
};

// Status helpers for assignment_targets
export const ASSIGNMENT_STATUSES = {
  pending: {
    label: "Pending",
    color: "bg-stone-100 text-stone-700 border-stone-300",
  },
  in_progress: {
    label: "In progress",
    color: "bg-amber-100 text-amber-800 border-amber-300",
  },
  paused: {
    label: "Paused",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  done: {
    label: "Done",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  blocked: {
    label: "Blocked",
    color: "bg-red-100 text-red-700 border-red-300",
  },
};

export const INVOICE_DESCR = {
  cleaning_check: "Cleaned all items failed during cleaning checks",
  move_out_check: "Move Out Cleaning",
  deep: "Deep clean",
  reclean: "Re-clean",
  standard: "Standard cleaning",
};

// Brand constants for the printable invoice.
export const SUMMIT_LOGO_URL =
  "https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png";
export const SUMMIT_COMPANY = {
  name: "Summit Clean LLC",
  lines: ["1391 North 380 West", "Provo, Utah 84604", "United States"],
  url: "www.gosummitclean.com",
};
export const INVOICE_TYPE_LABEL = {
  cleaning_check: "Cleaning Checks Cleaning",
  move_out_check: "Move Out Cleaning",
  deep: "Deep Clean",
  reclean: "Re-clean",
  standard: "Standard Cleaning",
};
export const INVOICE_STATUS_STYLE = {
  draft: "bg-stone-100 text-stone-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const STALE_IDLE_MIN = 90; // soft auto-clockout threshold (minutes)
const STALE_FORCE_MIN = 120; // hard force-close threshold (minutes)
// Sanity ceiling for a SINGLE finished work block, used by the money
// reports. The two thresholds above only fire while a block is still
// open, and only when someone loads the owner's Daily view — so a block
// that nobody force-closed for a week ends up stored with end_time set
// days after start_time. Those rows are not labor, they're forgotten
// clock-outs, and left alone they quietly wreck any profit number.
// Eight hours is longer than any real bedroom clean but short enough to
// catch the runaways.
export const MAX_BLOCK_HOURS = 8;
export { STALE_IDLE_MIN, STALE_FORCE_MIN };
