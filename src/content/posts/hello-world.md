---
title: 你好，世界
published: 2026-07-25
description: 新博客的第一篇占位文章，用来检查排版、代码块、公式和图片的显示效果。
tags: [占位, 排版测试]
category: 杂谈
draft: false
---

这是一篇占位文章。框架调试满意之后，把它删掉换成真正的内容即可。

## 段落与强调

正文使用常规字号，**粗体**、*斜体*、~~删除线~~、`行内代码` 都在这里出现一次，方便检查它们在毛玻璃背景上的对比度是否够。

> 引用块。用来确认左侧竖线和内边距是否协调。

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套项
- 第三项

有序列表：

1. 准备框架
2. 调试样式
3. 填充内容

## 代码块

```ts
interface Post {
  title: string;
  published: Date;
  tags: string[];
}

function summarize(posts: Post[]): string {
  const total = posts.length;
  const tags = new Set(posts.flatMap((p) => p.tags));
  return `${total} 篇文章，${tags.size} 个标签`;
}
```

## 表格

| 页面 | 路径 | 状态 |
| --- | --- | --- |
| 首页 | `/` | 已完成 |
| 归档 | `/archive/` | 已完成 |
| 分类 | `/categories/` | 已完成 |
| 标签 | `/tags/` | 已完成 |

## 数学公式

行内公式 $E = mc^2$，以及独立公式：

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

## 分割线之后

---

最后一段，用来确认文章底部与上下篇导航之间的间距。
