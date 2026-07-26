---
title: "python线程"
published: 2026-07-26
tags: ["python"]
category: "AIinfraGuide"
draft: false
lang: "zh_CN"
---
[并发和并行](并发和并行.md)
```python
import threading

counter = 0  # 共享的"记账本"，从 0 开始

def add_many_times():
    global counter          # 声明：我要修改外面那个 counter
    for _ in range(100000): # 每个线程加 10 万次
        counter += 1        # 危险操作：读取—修改—写回

# 造 2 个线程，让它们同时干活
t1 = threading.Thread(target=add_many_times)
t2 = threading.Thread(target=add_many_times)

t1.start()   # 启动
t2.start()
t1.join()    # 等它们都干完
t2.join()

print(counter)  # 期望是 200000，但你多半会看到一个更小的数字
```

这里加法非原子操作,每次都要分三步,移动到寄存器中,加法,移回
