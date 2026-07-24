import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";

hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("go", go);
hljs.registerLanguage("javascript", javascript);

const LANG_MAP = {
  cpp: "cpp",
  python: "python",
  java: "java",
  go: "go",
  javascript: "javascript",
};

export function highlightCode(code, lang) {
  const language = LANG_MAP[lang] ?? lang;
  try {
    if (hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }
  } catch {
    /* fall through */
  }
  return hljs.highlightAuto(code).value;
}
