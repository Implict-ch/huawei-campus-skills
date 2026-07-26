import { Link } from "react-router-dom";
import { isInternalPath, withAgentReferrer } from "../utils.js";
import { AgentGalleryContext } from "./galleryContext.js";
import {
  classNameIncludes,
  collectImagesFromMdastNode,
  collectImagesFromReactChildren,
  resolveAgentImageSrc,
} from "./images.js";
import AgentMarkdownImage from "./AgentMarkdownImage.jsx";

export function createMarkdownComponents(onOpenImage) {
  return {
    a: ({ href, children }) => {
      if (isInternalPath(href)) {
        return (
          <Link to={withAgentReferrer(href)} state={{ from: "agent" }}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="agent-message__table-wrap">
        <table>{children}</table>
      </div>
    ),
    p: ({ children, className, node, ...props }) => {
      const isGallery =
        props["data-agent-gallery"] === true ||
        props["data-agent-gallery"] === "true" ||
        classNameIncludes(className, "agent-message__img-row");
      if (isGallery) {
        let images = collectImagesFromMdastNode(node);
        if (images.length < 2) {
          const fromChildren = collectImagesFromReactChildren(children);
          if (fromChildren.length > images.length) images = fromChildren;
        }
        return (
          <AgentGalleryContext.Provider value={images}>
            <div className="agent-message__img-row" role="list" aria-label="配图列表">
              {children}
            </div>
          </AgentGalleryContext.Provider>
        );
      }
      return (
        <p className={className} {...props}>
          {children}
        </p>
      );
    },
    img: ({ src, alt }) => {
      const resolved = resolveAgentImageSrc(src);
      if (!resolved) return null;
      const isKb = resolved.startsWith("/knowledge-assets/");
      const isHttp = /^https?:\/\//i.test(resolved);
      if (!isKb && !isHttp) return null;
      return (
        <AgentMarkdownImage src={resolved} alt={alt || ""} onOpenImage={onOpenImage} />
      );
    },
  };
}
