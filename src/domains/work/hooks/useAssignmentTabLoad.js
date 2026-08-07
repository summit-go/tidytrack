import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase.js";
import { TASK_CATEGORIES } from "../../../lib/constants.js";
import { buildingFromLabel, naturalCompare } from "../../../lib/compare.js";
import { useOpenWorkBlocksAtProperty } from "./useOpenWorkBlocksAtProperty.js";
import { usePropertyAssignmentTargets } from "./usePropertyAssignmentTargets.js";

/**
 * Paginated assignment load, tasks-by-bedroom index, client-side filters,
 * and building grouping for AssignmentTabContent.
 */
export function useAssignmentTabLoad({ propertyId, statusFilter, employeeId }) {
  const [filterBuildings, setFilterBuildings] = useState(new Set());
  const [filterTypes, setFilterTypes] = useState(new Set());
  const [filterCleaners, setFilterCleaners] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [aptSearch, setAptSearch] = useState("");
  const [doneWindow, setDoneWindow] = useState("recent");
  const [filterCategories, setFilterCategories] = useState(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const recentCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const whosHereByParty = useOpenWorkBlocksAtProperty({
    propertyId,
    excludeEmployeeId: employeeId,
  });

  const { targets, setTargets, loaded, loadError, reload } =
    usePropertyAssignmentTargets({
      propertyId,
      statusFilter,
      employeeId,
    });

  const [tasksByBedroom, setTasksByBedroom] = useState({});
  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select(
          "category, work_block:work_blocks!inner(unit_id, party_id, shift:shifts!inner(customer_id))",
        )
        .not("category", "is", null);
      const map = {};
      (data || []).forEach((t) => {
        const wb = t.work_block;
        if (!wb || wb.shift?.customer_id !== propertyId) return;
        if (!wb.unit_id || !wb.party_id) return;
        const key = `${wb.unit_id}:${wb.party_id}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(t.category);
      });
      setTasksByBedroom(map);
    })();
  }, [propertyId, targets.length]);

  const isDoneTab =
    statusFilter === "done" ||
    statusFilter === "mine_today" ||
    statusFilter === "recheck_passed";

  const isDoneView =
    statusFilter === "done" ||
    statusFilter === "mine" ||
    statusFilter === "recheck_passed";

  const filteredTargets = targets.filter((t) => {
    if (filterTypes.size > 0) {
      const typ = t.assignment?.assignment_type || "";
      if (!filterTypes.has(typ)) return false;
    }
    if (filterCleaners.size > 0) {
      const ids = [t.starter?.id, t.completer?.id].filter(Boolean);
      const hit = ids.some((id) => filterCleaners.has(id));
      if (!hit) return false;
    }
    if (dateFrom || dateTo) {
      const cd = t.completed_at
        ? new Date(t.completed_at).toISOString().slice(0, 10)
        : null;
      if (!cd) return false;
      if (dateFrom && cd < dateFrom) return false;
      if (dateTo && cd > dateTo) return false;
    } else if (isDoneTab && doneWindow === "recent") {
      const cd = t.completed_at
        ? new Date(t.completed_at).toISOString().slice(0, 10)
        : null;
      if (!cd || cd < recentCutoff) return false;
    }
    if (filterCategories.size > 0) {
      if (!t.unit_id || !t.party_id) return false;
      const key = `${t.unit_id}:${t.party_id}`;
      const cats = tasksByBedroom[key];
      if (!cats) return false;
      const hit = Array.from(filterCategories).some((c) => cats.has(c));
      if (!hit) return false;
    }
    if (aptSearch.trim()) {
      const q = aptSearch.trim().toLowerCase();
      const label =
        `${t.unit?.label || ""} ${t.party?.label || ""}`.toLowerCase();
      if (!label.includes(q)) return false;
    }
    return true;
  });

  const availableTypes = [
    ...new Set(
      targets.map((t) => t.assignment?.assignment_type).filter(Boolean),
    ),
  ];

  const availableCleaners = (() => {
    const map = new Map();
    targets.forEach((t) => {
      if (t.starter?.id) map.set(t.starter.id, t.starter);
      if (t.completer?.id) map.set(t.completer.id, t.completer);
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  })();

  const availableCategories = (() => {
    const cats = new Set();
    Object.values(tasksByBedroom).forEach((s) => s.forEach((c) => cats.add(c)));
    return TASK_CATEGORIES.filter((c) => cats.has(c.id));
  })();

  const activeFilterCount =
    (filterTypes.size > 0 ? 1 : 0) +
    (filterCleaners.size > 0 ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (filterCategories.size > 0 ? 1 : 0);

  const toggleSetValue = (setter) => (value) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const toggleType = toggleSetValue(setFilterTypes);
  const toggleCleaner = toggleSetValue(setFilterCleaners);
  const toggleCategory = toggleSetValue(setFilterCategories);

  const toggleBuilding = (b) =>
    setFilterBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  const buildings = {};
  filteredTargets.forEach((t) => {
    const b = buildingFromLabel(t.unit?.label) || "—";
    if (!buildings[b]) buildings[b] = [];
    buildings[b].push(t);
  });

  const buildingKeys = Object.keys(buildings).sort(naturalCompare);

  const visibleBuildings =
    filterBuildings.size === 0
      ? buildingKeys
      : buildingKeys.filter((k) => filterBuildings.has(k));

  const countBedrooms = useCallback((list) => {
    const s = new Set();
    (list || []).forEach((t) =>
      s.add(t.assignment_id || `${t.unit_id || ""}::${t.party_id || ""}`),
    );
    return s.size;
  }, []);

  const globalPriorityItems =
    statusFilter === "pending"
      ? visibleBuildings
          .flatMap((b) => buildings[b])
          .filter(
            (t) => t.priority && t.status !== "done" && t.status !== "blocked",
          )
      : [];

  const clearAllFilters = useCallback(() => {
    setFilterTypes(new Set());
    setFilterCleaners(new Set());
    setDateFrom("");
    setDateTo("");
    setFilterCategories(new Set());
  }, []);

  return {
    targets,
    setTargets,
    loaded,
    loadError,
    reload,
    whosHereByParty,
    tasksByBedroom,
    filterBuildings,
    setFilterBuildings,
    filterTypes,
    setFilterTypes,
    filterCleaners,
    setFilterCleaners,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    aptSearch,
    setAptSearch,
    doneWindow,
    setDoneWindow,
    filterCategories,
    setFilterCategories,
    filtersOpen,
    setFiltersOpen,
    recentCutoff,
    isDoneTab,
    isDoneView,
    filteredTargets,
    availableTypes,
    availableCleaners,
    availableCategories,
    activeFilterCount,
    toggleType,
    toggleCleaner,
    toggleCategory,
    toggleBuilding,
    clearAllFilters,
    buildings,
    buildingKeys,
    visibleBuildings,
    countBedrooms,
    globalPriorityItems,
  };
}
