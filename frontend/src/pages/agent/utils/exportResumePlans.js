import JSZip from "jszip";

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function fallbackDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 将各组面试题打成 zip：优先 showDirectoryPicker 写入用户选中目录；
 * 不支持或失败时回退为浏览器默认下载。
 */
export async function exportResumePlansZip({ plans, roleLabel = "" }) {
  const list = Array.isArray(plans) ? plans.filter((p) => p?.markdown) : [];
  if (!list.length) throw new Error("没有可导出的面试题分组");

  const zip = new JSZip();
  const folderName = "简历模拟面试";
  const folder = zip.folder(folderName);
  const readme = [
    `# 简历模拟面试`,
    "",
    roleLabel ? `- 岗位方向：${roleLabel}` : "",
    `- 共 ${list.length} 组`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 文件列表",
    ...list.map((p, i) => `- 第${i + 1}组.md${p.angle ? `（${p.angle}）` : ""}`),
    "",
  ]
    .filter(Boolean)
    .join("\n");
  folder.file("README.md", readme);
  list.forEach((p, i) => {
    const name = `第${i + 1}组.md`;
    folder.file(name, p.markdown);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `简历模拟面试-${stamp()}.zip`;

  if (typeof window.showDirectoryPicker === "function") {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { mode: "directory", fileName };
    } catch (err) {
      if (err?.name === "AbortError") {
        return { mode: "cancelled" };
      }
      // 权限/环境不支持时回退下载
      console.warn("[export] directory picker failed, fallback download", err);
    }
  }

  fallbackDownload(blob, fileName);
  return { mode: "download", fileName };
}
