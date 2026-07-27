---
title: "AI infra学习路径汇总"
published: 2026-07-27
tags: ["学习路线"]
category: "AI infra"
draft: false
lang: "zh_CN"
---
B站
## 第一批：技术主线

| UP 主                                                        | 主要方向            | 推荐内容                                                          | 推荐理由                        |
| ----------------------------------------------------------- | --------------- | ------------------------------------------------------------- | --------------------------- |
| [InfiniTensor](https://space.bilibili.com/3546813525134159) | AI 系统、并行计算、算子优化 | [大模型并行与通信优化](https://www.bilibili.com/video/BV1JqKb6AEEY)     | 覆盖 CUDA、OpenCL、Triton 和并行策略 |
| [我是傅傅猪](https://space.bilibili.com/1822828582)              | vLLM 源码、自制推理框架  | [vLLM 引擎架构与流式推理](https://www.bilibili.com/video/BV14zsozJE5B) | 适合通过源码和自制框架进入推理 Infra       |

## 第二批：路线与职业方向

| UP 主                                                    | 路线参考价值                                         | 推荐内容                                                                 |
| ------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| [程序员段亮亮](https://space.bilibili.com/3546793828682033)   | 从 C++、学历门槛、岗位和薪资角度解释 AI Infra 全貌               | [AI Infra 是什么及学习路线](https://www.bilibili.com/video/BV11xDsBuEhi)     |
| [llm氪ke普课](https://space.bilibili.com/3546928149171044) | 梳理 LLM Infra 所需的系统、GPU、训练和推理知识                 | [AI Infra 入门知识完整梳理](https://www.bilibili.com/video/BV1BxL561EaF)     |
| [某时qnq](https://space.bilibili.com/439465595)           | 串起 AI 编译器、TVM、Triton、XLA 等概念                   | [AI Infra 十分钟入门](https://www.bilibili.com/video/BV1Hz33z1EK6)        |
| [杜子源源](https://space.bilibili.com/1223644844)           | 路线集中在 CUDA、Triton、PyTorch Kernel 和算子开发         | [招聘要求与学习路线](https://www.bilibili.com/video/BV1qKQGBtEDE)             |
| [Vensenmu](https://space.bilibili.com/341894601)        | 从 Java 转向 Infra 的真实路线，PyTorch、vLLM、CUTLASS 贡献者 | [从 Java 转 AI Infra 的路线](https://www.bilibili.com/video/BV1nswizfEZB) |
| [不归牛顿管的熊猫](https://space.bilibili.com/393625476)        | CUDA、GPU 体系结构、算子、量化与部署                         | [CUDA 与 GPU 算子市场分析](https://www.bilibili.com/video/BV1V6FHzvE6S)     |
| [月球大叔](https://space.bilibili.com/15452596)             | 采访 AI Infra 从业者，观察行业和招聘需求                      | [AI Infra 选手如何求职](https://www.bilibili.com/video/BV1vLfmY5Egf)       |
|                                                         |                                                |                                                                      |
有用的github仓库:[cr7258/ai-infra-learning: This repository organizes materials, recordings, and schedules related to AI-infra learning meetings.](https://github.com/cr7258/ai-infra-learning/tree/main)

### 知乎
### 1. AI Infra 入门总问题

[求教，研 0 如何入门 AI Infra？](https://www.zhihu.com/question/664742369)



## 六、作者索引

以下作者均为本次两轮检索中核验过的账号；前 14 位来自第一轮，后 15 位为本次新增作者。

## 建议学习顺序

```text
Linux / C++ / Python
    ↓
计算机体系结构、GPU、显存层次、并行计算
    ↓
CUDA + Triton + Nsight Systems/Compute + benchmark
    ↓
GEMM、Softmax、LayerNorm、FlashAttention、量化 kernel
    ↓
MPI / NCCL / AllReduce / AllGather / ReduceScatter / RDMA
    ↓
PyTorch Distributed / FSDP / Megatron-LM / DeepSpeed
    ↓
vLLM / SGLang / TensorRT-LLM：调度、KV Cache、Continuous Batching
    ↓
Prefill/Decode、PD 分离、Speculative Decoding、MoE、FP8/FP4
    ↓
Kubernetes、GPU 调度、模型服务、监控、弹性和成本优化
```

### 推荐的阶段性产出

1. 用 CUDA 写 `vector add`、`reduce`、`softmax` 和 tiled matmul。
2. 用 Nsight 或 PyTorch Profiler 找出一个真实性能瓶颈，并写 benchmark。
3. 用 NCCL 实现并测量 AllReduce、AllGather 和 ReduceScatter。
4. 跑通一个小模型的 FSDP/Megatron/DeepSpeed 训练任务。
5. 阅读并改造 nano-vLLM，理解 scheduler、KV Cache 和 continuous batching。
6. 做一个量化或 FlashAttention 实验，记录吞吐、延迟、显存和精度变化。
7. 用 Docker/Kubernetes 部署模型服务，加入日志、监控和限流。

## 八、额外路线索引

- [AIInfraGuide](https://caomaolufei.github.io/AIInfraGuide/)：按前置基础、CUDA/算子、分布式训练、推理优化、性能分析分层。
- [AI Infra Academy](https://www.aiinfra.pub/)：聚焦 CUDA、Triton、FlashAttention、vLLM、SGLang、MoE 和推理优化，并提供在线算子评测。

# 小红书：AI Infra 学习路线
## 相关帖子（10 条）

1. [上岸大厂 AI Infra 自学秘籍大公开](https://www.xiaohongshu.com/explore/6819eab10000000021006d5a?xsec_token=ABgDUbTY-hrQRR6X0fO6zhqoAaExURjqQbrV6JNFkQpYU%3D&xsec_source=pc_search)
   - 作者：Bound
   - 互动：540 赞、1136 收藏、56 评论

2. [新人自认为的 AI Infra 路线（聚焦推理链路）](https://www.xiaohongshu.com/explore/69f472cc000000001e00ce1d?xsec_token=ABlDPY_GcDxUq1i6oRn4uCIKgai0N_XdoeMPir1jcjKUQ%3D&xsec_source=pc_search)
   - 作者：银弹
   - 互动：2088 赞、3982 收藏、99 评论

3. [我的 AI Infra 极限转型学习路线（野路子版）](https://www.xiaohongshu.com/explore/69ac389a000000000e03c9b9?xsec_token=ABAKDrXh-PKVayXh7wUe2fyc22E1_F6HHp71mNWIv5aEE%3D&xsec_source=pc_search)
   - 作者：AILIST
   - 互动：709 赞、1236 收藏、44 评论

4. [AI Infra 学习路线](https://www.xiaohongshu.com/explore/68ef3bbc0000000005010bb1?xsec_token=AB1FoIvp7zvAJfHe9872oBERIBe-nmMXqEmJFzx37MHFo%3D&xsec_source=pc_search)
   - 作者：Hirox
   - 互动：1397 赞、2505 收藏、71 评论

5. [转行 AI Infra 怎么学：基础知识储备篇](https://www.xiaohongshu.com/explore/69b285df000000000603065b?xsec_token=ABGroTodo2LRuY2tsffmNxoQ6x_ZXr_hQNMdnOZdkfUx8%3D&xsec_source=pc_search)
   - 作者：星星大王
   - 互动：254 赞、420 收藏、16 评论

6. [本科生可以做 AI Infra/HPC 吗？](https://www.xiaohongshu.com/explore/6735db07000000001b013838?xsec_token=ABT5rgf_DJgAPErl46hVcu5eLlODWoWoCluzEgNtzpk7w%3D&xsec_source=pc_search)
   - 作者：Jerry（停更版）
   - 互动：796 赞、1246 收藏、27 评论

7. [AI Infra 学习入坑指南（小小失败版）- 2](https://www.xiaohongshu.com/explore/697cac990000000022039b78?xsec_token=ABNzBjqTjLT6Bv_7N2bqF4dGXtRHhlaN9rN1lMNPj_YSE%3D&xsec_source=pc_search)
   - 作者：BubbleFish
   - 互动：391 赞、658 收藏、46 评论

8. [普通学生的几种不同入行路径和方向对比](https://www.xiaohongshu.com/explore/6a259970000000001502527d?xsec_token=AB1fpZrMncrW6LeAKEL4_Xg2RkaXuF2GWBnKa_p5N-cpI&xsec_source=pc_search)
   - 作者：NothingInfra
   - 互动：135 赞、169 收藏、67 评论

9. [AI Infra 学习路线精简版](https://www.xiaohongshu.com/explore/69ca300d000000001a02ae17?xsec_token=ABxFMFCEoFRIFmqBKEYekIDH0niuDyhD2OoWqGQnX2CZA%3D&xsec_source=pc_search)
   - 作者：草帽路飞
   - 互动：294 赞、603 收藏、17 评论
