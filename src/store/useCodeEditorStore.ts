import { CodeEditorState } from "./../types/index";
import { LANGUAGE_CONFIG } from "@/app/(root)/_constants";
import { create } from "zustand";
import { Monaco } from "@monaco-editor/react";

const getInitialState = () => {
  // FIX: Always return defaults on server
  return {
    language: "javascript",
    fontSize: 16,
    theme: "vs-dark",
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
  // Only access localStorage in useEffect or after mount
  const initialState = getInitialState();

  return {
    ...initialState,
    output: "",
    isRunning: false,
    error: null,
    editor: null,
    executionResult: null,

    getCode: () => get().editor?.getValue() || "",

    setEditor: (editor: Monaco) => {
      // Only access localStorage in client
      if (typeof window !== "undefined") {
        const savedCode = localStorage.getItem(`editor-code-${get().language}`);
        if (savedCode) editor.setValue(savedCode);
      }
      set({ editor });
    },

    setTheme: (theme: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("editor-theme", theme);
      }
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("editor-font-size", fontSize.toString());
      }
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      // Save current language code before switching
      if (typeof window !== "undefined") {
        const currentCode = get().editor?.getValue();
        if (currentCode) {
          localStorage.setItem(`editor-code-${get().language}`, currentCode);
        }
        localStorage.setItem("editor-language", language);
      }

      set({
        language,
        output: "",
        error: null,
      });
    },

    runCode: async () => {
      const { language, getCode } = get();
      const code = getCode();

      if (!code) {
        set({ error: "Please enter some code" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        // Direct JDoodle API call - no mapping needed
        // Use a free CORS proxy to bypass the browser restriction
        const proxyUrl = "https://corsproxy.io/?";
        const apiUrl = "https://api.jdoodle.com/v1/execute";

        const response = await fetch(proxyUrl + encodeURIComponent(apiUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId: "209b994e6a76b2c91281e0ce5afaad72",
            clientSecret: "b34783ae923b5a3c98a9805e4b1d6ac49238a98378e0f518711f83db2d5db357",
            script: code,
            language: "python3",
            versionIndex: "0",
            stdin: ""
          }),
        });

        const data = await response.json();
        console.log("JDoodle response:", data);

        // Simple output handling
        if (data.output) {
          set({ 
            output: data.output.trim(), 
            error: null,
            executionResult: { 
              code, 
              output: data.output.trim(), 
              error: null 
            }
          });
        } else if (data.error) {
          set({ 
            error: data.error,
            executionResult: { 
              code, 
              output: "", 
              error: data.error 
            }
          });
        }
      } catch (error) {
        console.log("Error:", error);
        set({ 
          error: "Failed to run code",
          executionResult: { 
            code, 
            output: "", 
            error: "Failed to run code" 
          }
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;