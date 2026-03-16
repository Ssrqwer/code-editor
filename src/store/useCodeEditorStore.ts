import { CodeEditorState } from "./../types/index";
import { LANGUAGE_CONFIG } from "@/app/(root)/_constants";
import { create } from "zustand";
import { Monaco } from "@monaco-editor/react";

const getInitialState = () => {
  // if we're on the server, return default values
  if (typeof window === "undefined") {
    return {
      language: "javascript",
      fontSize: 16,
      theme: "vs-dark",
    };
  }

  // if we're on the client, return values from local storage bc localStorage is a browser API.
  const savedLanguage = localStorage.getItem("editor-language") || "javascript";
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;

  return {
    language: savedLanguage,
    theme: savedTheme,
    fontSize: Number(savedFontSize),
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
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
      const savedCode = localStorage.getItem(`editor-code-${get().language}`);
      if (savedCode) editor.setValue(savedCode);

      set({ editor });
    },

    setTheme: (theme: string) => {
      localStorage.setItem("editor-theme", theme);
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      localStorage.setItem("editor-font-size", fontSize.toString());
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      // Save current language code before switching
      const currentCode = get().editor?.getValue();
      if (currentCode) {
        localStorage.setItem(`editor-code-${get().language}`, currentCode);
      }

      localStorage.setItem("editor-language", language);

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
        // Hardcoded language mapping with proper typing
        const languageMap: Record<string, string> = {
          'javascript': 'nodejs',
          'typescript': 'typescript',
          'python': 'python3',
          'java': 'java',
          'go': 'go',
          'rust': 'rust',
          'cpp': 'cpp17',
          'csharp': 'csharp',
          'ruby': 'ruby',
          'swift': 'swift'
        };

        // JDoodle API call
        const response = await fetch("https://api.jdoodle.com/v1/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId: "209b994e6a76b2c91281e0ce5afaad72",
            clientSecret: "b34783ae923b5a3c98a9805e4b1d6ac49238a98378e0f518711f83db2d5db357",
            script: code,
            language: languageMap[language] || 'python3',
            versionIndex: "0",
            stdin: ""
          }),
        });

        interface JDoodleResponse {
          output?: string;
          error?: string;
          statusCode?: number;
          memory?: string;
          cpuTime?: string;
        }

        const data: JDoodleResponse = await response.json();

        console.log("data back from jdoodle:", data);

        // Transform JDoodle response to match Piston format
        const pistonFormattedData = {
          run: {
            output: data.output || data.error || '',
            stderr: data.error || '',
            stdout: data.output || '',
            code: data.statusCode === 200 ? 0 : 1,
            signal: null
          }
        };

        // handle API-level errors
        if (data.error) {
          set({ error: data.error, executionResult: { code, output: "", error: data.error } });
          return;
        }

        // handle execution errors
        if (pistonFormattedData.run && pistonFormattedData.run.code !== 0) {
          const error = pistonFormattedData.run.stderr || pistonFormattedData.run.output;
          set({
            error,
            executionResult: {
              code,
              output: "",
              error,
            },
          });
          return;
        }

        // if we get here, execution was successful
        const output = pistonFormattedData.run.output;

        set({
          output: output.trim(),
          error: null,
          executionResult: {
            code,
            output: output.trim(),
            error: null,
          },
        });
      } catch (error) {
        console.log("Error running code:", error);
        set({
          error: "Error running code",
          executionResult: { code, output: "", error: "Error running code" },
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;
