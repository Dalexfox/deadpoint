// Branded video compositing is iOS-only — there's no web implementation.
// Exporting null matches the native module's `Module | null` shape so callers
// fall back to sharing the plain video / still card.
export default null;
