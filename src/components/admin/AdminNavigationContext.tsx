import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const AdminNavigationContext = createContext({
  hasPageNavigation: false,
  registerPageNavigation: (): (() => void) => () => {},
});

/** A page's full admin shell takes precedence over the root's fallback navigation. */
export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const [owners, setOwners] = useState(0);
  const registerPageNavigation = useCallback(() => {
    setOwners((count) => count + 1);
    return () => setOwners((count) => count - 1);
  }, []);
  const value = useMemo(
    () => ({ hasPageNavigation: owners > 0, registerPageNavigation }),
    [owners, registerPageNavigation],
  );
  return (
    <AdminNavigationContext.Provider value={value}>{children}</AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation() {
  return useContext(AdminNavigationContext);
}

export function usePageAdminNavigation() {
  const { registerPageNavigation } = useAdminNavigation();
  useEffect(() => registerPageNavigation(), [registerPageNavigation]);
}
