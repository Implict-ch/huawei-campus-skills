import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { renderToStaticMarkup } from "react-dom/server";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const file = "../knowledge/experiences/hw-exp-20260715-nc-70895872.md";
const raw = fs.readFileSync(file, "utf-8");
const { content } = matter(raw);

const element = React.createElement(ReactMarkdown, { remarkPlugins: [remarkBreaks] }, content);
const html = renderToStaticMarkup(element);

const brCount = (html.match(/<br\s*\/?>/g) || []).length;
const pCount = (html.match(/<p>/g) || []).length;
console.log("<br> count:", brCount);
console.log("<p> count:", pCount);
console.log("html length:", html.length);
console.log("first 1000 chars:\n", html.slice(0, 1000));
