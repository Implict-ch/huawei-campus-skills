import { Component } from "react";
import AppLink from "./AppLink.jsx";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const backHref = this.props.backHref ?? "/";

    return (
      <div className="problem-page-error">
        <h2 className="problem-page-error__title">页面渲染出错</h2>
        <p className="problem-page-error__message">
          正文或交互组件加载失败，请刷新或返回导航页。若为新文章，请检查 MDX 与组件用法。
        </p>
        <pre className="problem-page-error__detail">{error.message}</pre>
        <AppLink href={backHref} className="problem-page-error__back">
          返回
        </AppLink>
      </div>
    );
  }
}
