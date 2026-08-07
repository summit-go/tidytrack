import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Hook: load + manage per-property label overrides for the current
// locale. Returns:
//   overrides       — Map<template_item_key, label>
//   saveOverride    — (key, label) => Promise. Upserts the row.
//   removeOverride  — (key) => Promise. Deletes (revert to default).
//   reload          — refetch from DB.
// Pass propertyId='' or locale='en' to no-op (no overrides apply).
export function useItemLabelOverrides(propertyId, locale, employee) {
  const [overrides, setOverrides] = useState(new Map());
  const reload = useCallback(async () => {
    if (!propertyId || !locale || locale === "en") {
      setOverrides(new Map());
      return;
    }
    const { data } = await supabase
      .from("item_label_overrides")
      .select("template_item_key, label")
      .eq("property_id", propertyId)
      .eq("locale", locale);
    const m = new Map();
    (data || []).forEach((r) => m.set(r.template_item_key, r.label));
    setOverrides(m);
  }, [propertyId, locale]);
  useEffect(() => {
    reload();
  }, [reload]);

  const saveOverride = async (key, label) => {
    const trimmed = (label || "").trim();
    if (!key || !trimmed) return;
    if (!propertyId || !locale || locale === "en") return;
    // Upsert — onConflict (property_id, template_item_key, locale)
    const { error } = await supabase.from("item_label_overrides").upsert(
      {
        property_id: propertyId,
        template_item_key: key,
        locale,
        label: trimmed,
        edited_by: employee?.id || null,
        edited_at: new Date().toISOString(),
      },
      { onConflict: "property_id,template_item_key,locale" },
    );
    if (error) {
      alert("Could not save label: " + error.message);
      return;
    }
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, trimmed);
      return next;
    });
  };

  const removeOverride = async (key) => {
    if (!propertyId || !locale) return;
    const { error } = await supabase
      .from("item_label_overrides")
      .delete()
      .eq("property_id", propertyId)
      .eq("template_item_key", key)
      .eq("locale", locale);
    if (error) {
      alert("Could not revert: " + error.message);
      return;
    }
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  return { overrides, saveOverride, removeOverride, reload };
}
