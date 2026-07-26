import { useLocation } from "react-router-dom";
import { Icon } from "../icons/index.jsx";

/** 使用反馈问卷链接，配置后即可跳转 */
const FEEDBACK_SURVEY_URL = "";

/** 校招交流群二维码图片路径（占位，后续替换为真实二维码） */
const CAMPUS_GROUP_QR_SRC = "/qrcode-campus-group.svg";

export default function Footer() {
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "";
  const feedbackHref = FEEDBACK_SURVEY_URL.trim() || undefined;

  return (
    <footer className="footer">
      {/* 分割线上方：右下角导航（仅首页） */}
      {isHome && (
        <div className="footer__above">
          <div className="footer__nav">
            <div className="footer-nav-item footer-nav-item--qr">
              <button type="button" className="footer-nav-btn" aria-describedby="footer-qr-tip">
                <Icon name="users" size={16} color="currentColor" />
                <span>校招交流群</span>
              </button>
              <div id="footer-qr-tip" className="footer-qr-popover" role="tooltip">
                <p className="footer-qr-popover__title">扫码加入校招交流群</p>
                <div className="footer-qr-popover__frame">
                  <img
                    src={CAMPUS_GROUP_QR_SRC}
                    alt="校招交流群二维码占位"
                    width={140}
                    height={140}
                  />
                </div>
              </div>
            </div>

            {feedbackHref ? (
              <a
                className="footer-nav-btn"
                href={feedbackHref}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="write" size={16} color="currentColor" />
                <span>使用反馈</span>
              </a>
            ) : (
              <a
                className="footer-nav-btn footer-nav-btn--pending"
                href="#"
                title="问卷链接待配置"
                onClick={(e) => e.preventDefault()}
              >
                <Icon name="write" size={16} color="currentColor" />
                <span>使用反馈</span>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="footer__divider" aria-hidden="true" />

      {/* 分割线下方：品牌与版权 */}
      <div className="footer__bar">
        <div className="footer__brand">
          <div className="footer__logo">CF</div>
          <span className="footer__title">
            Code<span className="footer__title-accent">Fun</span>2000
          </span>
        </div>
        <div className="footer__meta">
          <span>© 2026 CodeFun2000</span>
        </div>
      </div>
    </footer>
  );
}
