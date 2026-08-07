// Split a task name into individual items when it was built from a
// multi-item pick (cleaner ticked several subsections + Start). The
// picker joins picks with " + " so we use that as the splitter.
// Returns an array — single-item tasks return [name].
export const splitTaskName = (name) => {
  if (!name) return [];
  // The picker uses " + " as the join string. Also handle " · " which
  // some older paths used as a separator.
  if (name.includes(" + ")) {
    return name
      .split(" + ")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [name];
};
