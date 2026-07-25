---
title: 博客框架搭建记录
published: 2026-07-20
description: 记录这个博客的技术选型、目录结构和部署方式，作为第二篇占位文章。
tags: [Astro, 建站, 占位]
category: 技术
draft: false
---

第二篇占位文章，主要用来验证列表页有多篇文章时的间距、分页，以及多标签的换行表现。

## 技术选型

- **Astro** —— 静态输出，Markdown 内容集合带类型校验
- **Tailwind CSS** —— 原子类，改样式不用来回切文件
- **Pagefind** —— 构建期生成索引的站内搜索，无需后端
- **GitHub Actions + Pages** —— 推送即部署

## 目录结构

```
src/
├── components/    组件
├── content/posts/ 文章 Markdown
├── layouts/       页面骨架
├── pages/         路由
└── styles/        全局样式与主题变量
```

## 待办

- [x] 全屏背景图与毛玻璃面板
- [x] 分类页、标签页
- [ ] 替换占位文章
- [ ] 配置 GitHub Pages 部署
