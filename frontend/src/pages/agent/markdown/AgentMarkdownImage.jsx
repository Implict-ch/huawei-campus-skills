import { useContext } from "react";
import { AgentGalleryContext } from "./galleryContext.js";

export default function AgentMarkdownImage({ src, alt, onOpenImage }) {
  const gallery = useContext(AgentGalleryContext);
  const images =
    Array.isArray(gallery) && gallery.length > 0 ? gallery : [{ src, alt: alt || "" }];
  const index = Math.max(
    0,
    images.findIndex((it) => it.src === src)
  );
  return (
    <button
      type="button"
      className="agent-message__img-btn"
      title={alt || "点击查看大图"}
      role={gallery ? "listitem" : undefined}
      onClick={() =>
        onOpenImage?.({
          src,
          alt: alt || "",
          images,
          index: index >= 0 ? index : 0,
        })
      }
    >
      <img
        src={src}
        alt={alt || ""}
        className="agent-message__img"
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget;
          el.classList.add("agent-message__img--missing");
          el.alt = alt ? `${alt}（图片待补充）` : "图片待补充";
        }}
      />
    </button>
  );
}
