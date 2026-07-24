import { H2, H3 } from "./components/headings.jsx";
import { ProseWrapper, QAList, Text, articleComponents } from "./components/article.jsx";

const sharedComponents = {
  wrapper: ProseWrapper,
  H2,
  H3,
  Text,
  QAList,
  ...articleComponents,
  strong: (props) => <strong {...props} />,
  code: (props) => {
    const { children, className, ...rest } = props;
    if (className) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return <code {...rest}>{children}</code>;
  },
};

/** MDX v3 编译时通过 providerImportSource 注入全局组件 */
export function useMDXComponents(components) {
  return { ...sharedComponents, ...components };
}

export const mdxComponents = sharedComponents;
