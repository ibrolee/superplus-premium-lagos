import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

export type AppearanceMode = "system" | "light" | "dark";

type AppearanceValue = {
  mode: AppearanceMode;
  colorScheme: "light" | "dark";
  setMode: (mode: AppearanceMode) => Promise<void>;
};

const STORAGE_KEY = "@superplus/appearance-mode";
const AppearanceContext = createContext<AppearanceValue | undefined>(undefined);

function applyMode(mode: AppearanceMode) {
  Appearance.setColorScheme(mode === "system" ? null : mode);
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<AppearanceMode>("system");
  const activeScheme = useColorScheme();

  useEffect(() => {
    let live = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (!live) return;
        const nextMode: AppearanceMode =
          savedMode === "light" || savedMode === "dark" || savedMode === "system"
            ? savedMode
            : "system";
        setModeState(nextMode);
        applyMode(nextMode);
      })
      .catch(() => {
        if (live) applyMode("system");
      });

    return () => {
      live = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: AppearanceMode) => {
    setModeState(nextMode);
    applyMode(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  }, []);

  const value = useMemo<AppearanceValue>(
    () => ({
      mode,
      colorScheme: activeScheme === "dark" ? "dark" : "light",
      setMode,
    }),
    [activeScheme, mode, setMode],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearancePreference() {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("useAppearancePreference must be used inside AppearanceProvider.");
  }
  return value;
}
