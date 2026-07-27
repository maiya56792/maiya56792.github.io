---
title: "CUDA向量加法：更多线程不一定更快"
published: 2026-07-27
tags: ["CUDA"]
category: "AI infra"
draft: false
lang: "zh_CN"
---
# CUDA 向量加法实验：为什么更多线程不一定更快

## 1. 实验目的

CUDA 最直观的入门例子之一，就是让 GPU 完成两个向量的逐元素相加：

```text
c[i] = a[i] + b[i]
```

这个实验使用相同的数据规模和相同的核函数，分别测试以下三种 CUDA 启动配置：

```cpp
<<<1, 1>>>
<<<256, 256>>>
<<<4096, 256>>>
```

实验希望回答两个问题：

1. 大量线程相对于单线程能带来多大的性能提升？
2. GPU 线程数量是不是越多越快？

实验结果表明，大规模并行相对于单线程确实有超过百倍的提升，但对于计算量极小、主要受内存访问限制的向量加法，继续增加线程和 block 数量并不一定能继续提升性能。

## 2. 实验环境与数据规模

实验 GPU 为 NVIDIA GeForce RTX 4060 Laptop GPU，具有 24 个 Streaming Multiprocessor，也就是 24 个 SM。

向量长度定义为：

```cpp
const size_t SIZE = 1 << 20;
```

因此：

```text
SIZE = 1,048,576 个 float
```

每个 `float` 占 4 字节，所以单个向量约为 4 MiB。程序中有输入向量 `a`、输入向量 `b` 和输出向量 `c`，一次完整向量加法至少需要：

```text
读取 a：4 MiB
读取 b：4 MiB
写入 c：4 MiB
总内存访问量：约 12 MiB
```

但是，每个元素真正执行的算术操作只有一次浮点加法。因此，这个程序的计算量非常小，主要成本通常来自内存访问，而不是浮点运算。

## 3. 公共核函数：Grid-Stride Loop

三个程序使用相同的核函数：

```cpp
template<typename T>
__global__ void add_kernel(T* c, const T* a, const T* b, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;

    for (int i = idx; i < n; i += stride) {
        c[i] = a[i] + b[i];
    }
}
```

其中，全局线程编号为：

```cpp
int idx = blockIdx.x * blockDim.x + threadIdx.x;
```

整个 grid 中的线程总数为：

```cpp
int stride = blockDim.x * gridDim.x;
```

每个线程首先处理 `idx` 对应的元素，然后每次增加一个 `stride`：

```text
idx
idx + stride
idx + 2 × stride
idx + 3 × stride
...
```

这种写法称为 grid-stride loop。它允许任意数量的线程共同处理任意长度的数据，而不要求线程总数必须等于元素总数。

不同 block 之间的实际执行顺序由 GPU 调度器决定，程序不能假设 block 0 一定在 block 1 之前执行。但本实验中，每个线程处理不同的 `c[i]`，线程之间没有数据依赖，因此执行顺序不会影响结果。

## 4. 版本一：`<<<1, 1>>>`

文件：`add1.cu`

```cpp
#include <vector>
#include <cstdio>
#include <chrono>

const size_t SIZE = 1 << 20;
size_t size_bytes = SIZE * sizeof(float);
dim3 block_dim(1);
dim3 grid_dim(1);

template<typename T>
__global__ void add_kernel(T* c, const T* a, const T* b, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    for (int i = idx; i < n; i += stride) {
        c[i] = a[i] + b[i];
    }
}

int main() {
    std::vector<float> h_a(SIZE, 1);
    std::vector<float> h_b(SIZE, 2);
    std::vector<float> h_c(SIZE, 0);

    float *d_a, *d_b, *d_c;
    cudaMalloc(&d_a, size_bytes);
    cudaMalloc(&d_b, size_bytes);
    cudaMalloc(&d_c, size_bytes);

    cudaMemcpy(d_a, h_a.data(), size_bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_b, h_b.data(), size_bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_c, h_c.data(), size_bytes, cudaMemcpyHostToDevice);

    cudaDeviceSynchronize();

    int repeat = 10;
    auto start = std::chrono::steady_clock::now();

    for (int i = 0; i < repeat; ++i) {
        add_kernel<<<grid_dim, block_dim>>>(d_c, d_a, d_b, SIZE);
    }

    cudaDeviceSynchronize();
    auto end = std::chrono::steady_clock::now();

    double total_us =
        std::chrono::duration<double, std::micro>(end - start).count();
    double average_us = total_us / repeat;

    cudaMemcpy(h_c.data(), d_c, size_bytes, cudaMemcpyDeviceToHost);
    printf("%f us\n", average_us);
}
```

该配置只有一个 block，并且 block 中只有一个线程：

```text
gridDim.x  = 1
blockDim.x = 1
idx        = 0
stride     = 1
```

唯一的线程按顺序处理：

```text
c[0], c[1], c[2], ..., c[1,048,575]
```

虽然程序运行在 GPU 上，但它几乎没有利用 GPU 的并行能力。更重要的是，单个线程在等待显存数据时，没有其他线程帮助隐藏内存访问延迟。因此，这个版本非常慢。

## 5. 版本二：`<<<256, 256>>>`

文件：`add256.cu`

这个版本的主要配置为：

```cpp
dim3 block_dim(256);
dim3 grid_dim(256);
```

核函数启动方式为：

```cpp
add_kernel<<<256, 256>>>(d_c, d_a, d_b, SIZE);
```

线程总数为：

```text
256 × 256 = 65,536
```

但是数据一共有 1,048,576 个元素，因此线程数量只有数据量的十六分之一：

```text
1,048,576 / 65,536 = 16
```

借助 grid-stride loop，每个线程可以处理 16 个元素。例如，全局编号为 0 的线程处理：

```text
0
65,536
131,072
196,608
...
983,040
```

全局编号为 1 的线程处理：

```text
1
65,537
131,073
196,609
...
983,041
```

每次循环中，相邻线程仍然访问相邻的数组元素。例如，一个 warp 的 32 个线程会访问一段连续内存，这有利于产生合并内存访问。

如果没有 grid-stride loop，而核函数只写成：

```cpp
int idx = blockIdx.x * blockDim.x + threadIdx.x;
if (idx < n) {
    c[idx] = a[idx] + b[idx];
}
```

那么 `<<<256, 256>>>` 只能处理下标 `0` 到 `65,535`，剩余元素不会被计算。

## 6. 版本三：每个元素对应一个线程

文件：`add.cu`

该版本使用：

```cpp
dim3 block_dim(256);
dim3 grid_dim((SIZE + block_dim.x - 1) / block_dim.x);
```

当前数据规模可以被 256 整除，因此：

```text
gridDim.x = 1,048,576 / 256 = 4096
```

实际启动配置为：

```cpp
add_kernel<<<4096, 256>>>(d_c, d_a, d_b, SIZE);
```

线程总数为：

```text
4096 × 256 = 1,048,576
```

线程数正好等于元素数，所以每个线程只处理一个元素。此时 grid-stride loop 仍然正确，但循环只执行一次。

需要注意的是，启动 4096 个 block 不代表这些 block 会同时运行。GPU 只能让有限数量的 block 同时驻留在 SM 上，其余 block 必须等待前面的 block 完成。

## 7. CPU 端计时方法

CUDA 核函数启动通常是异步的。CPU 执行完下面的语句后，核函数可能仍然在 GPU 上运行：

```cpp
add_kernel<<<grid_dim, block_dim>>>(d_c, d_a, d_b, SIZE);
```

因此，使用 CPU 的 `std::chrono` 计时时，必须在停止计时之前调用：

```cpp
cudaDeviceSynchronize();
```

本实验使用以下计时结构：

```cpp
auto start = std::chrono::steady_clock::now();

for (int i = 0; i < repeat; ++i) {
    add_kernel<<<grid_dim, block_dim>>>(d_c, d_a, d_b, SIZE);
}

cudaDeviceSynchronize();

auto end = std::chrono::steady_clock::now();
```

计时范围只包含核函数启动和 GPU 执行，不包含 `cudaMalloc`、主机到设备的数据复制以及设备到主机的数据复制。

## 8. `-O3` 编译与实测结果

三个程序使用相同的优化参数编译：

```bash
nvcc -O3 add1.cu -o add1
nvcc -O3 add256.cu -o add256
nvcc -O3 add.cu -o add
```

一次实测结果为：

```text
./add1
42079.114400 us

./add256
233.894100 us

./add
379.018300 us
```

整理如下：

| 启动配置 | 线程总数 | 每线程处理元素数 | 平均时间 |
|---|---:|---:|---:|
| `<<<1,1>>>` | 1 | 1,048,576 | 42,079.1144 μs |
| `<<<256,256>>>` | 65,536 | 16 | 233.8941 μs |
| `<<<4096,256>>>` | 1,048,576 | 1 | 379.0183 μs |

以 `<<<1,1>>>` 为基准：

```text
<<<256,256>>> 加速比约为 42,079.1144 / 233.8941 ≈ 180 倍
<<<4096,256>>> 加速比约为 42,079.1144 / 379.0183 ≈ 111 倍
```

两个并行版本都远快于单线程版本，说明 GPU 必须依靠大量并发线程隐藏内存访问延迟。

但这次测试中，线程数量较少的 `<<<256,256>>>` 反而比 `<<<4096,256>>>` 更快：

```text
379.0183 / 233.8941 ≈ 1.62
```

也就是说，这一次运行中，`<<<256,256>>>` 约快 1.62 倍。

## 9. 为什么 `-O3` 没有明显改变时间

`-O3` 主要帮助编译器优化计算指令、循环和主机端代码。但是本实验中，每个元素只有一次非常简单的加法：

```cpp
c[i] = a[i] + b[i];
```

真正需要完成的是两次读取和一次写入。相对于内存访问成本，一次浮点加法的成本很低。

因此，即使编译器进一步优化了指令，程序仍然需要等待数据到达计算单元，并将结果写回内存。对这种内存访问占主导地位的程序，单纯增加编译优化等级通常不会像计算密集型程序那样带来明显变化。

这并不表示 `-O3` 没有价值。统一使用 `-O3` 可以让不同版本处在相同的编译条件下，避免主机端代码和循环优化差异干扰实验。但是，`-O3` 不能消除显存延迟、内存带宽上限、核函数启动开销和 block 调度开销。

## 10. 为什么更多线程不一定更快

### 10.1 GPU 不能同时执行所有线程

RTX 4060 Laptop GPU 有 24 个 SM。每个 SM 能同时驻留的线程和 block 数量存在硬件上限。

当 block 大小为 256 时，如果只按每个 SM 最多 1,536 个线程估算，一个 SM 理论上最多同时驻留：

```text
1536 / 256 = 6 个 block
```

24 个 SM 理论上可以同时驻留：

```text
24 × 6 = 144 个 block
```

实际驻留数量还可能受到寄存器、共享内存和硬件 block 上限影响。

`<<<256,256>>>` 已经提供了 256 个 block，超过了理论上的 144 个并发驻留 block，因此通常已经有足够的工作让所有 SM 保持忙碌。

`<<<4096,256>>>` 虽然提供了更多 block，但这些 block 不会同时运行。大量 block 只能排队，等待前面的 block 执行完成。

### 10.2 更多 block 会增加调度工作

两个版本处理的数据总量完全相同：都要读取两个长度为 1,048,576 的向量，并写入一个同样长度的输出向量。

区别在于：

```text
<<<256,256>>>：256 个 block，每个线程循环 16 次
<<<4096,256>>>：4096 个 block，每个线程循环 1 次
```

后者需要调度和结束更多 block。虽然 GPU 的 block 调度是硬件完成的，开销远小于 CPU 线程调度，但它仍然不是完全免费的。

只要 256 个 block 已经能充分占用 GPU，继续增加到 4096 个 block 就不一定产生额外的有效并行度，反而可能增加 grid 遍历、block 调度以及最后一批 block 造成的尾部开销。

### 10.3 每个线程只做一次加法，工作粒度太小

在 `<<<4096,256>>>` 中，每个线程只执行一次向量加法。线程完成的有效工作非常少：

```text
读取 a[i]
读取 b[i]
执行一次加法
写入 c[i]
结束
```

相比之下，`<<<256,256>>>` 中每个线程循环处理 16 个元素。它在不牺牲足够并行度的前提下，提高了每个线程承担的工作量，并减少了总 block 数量。

这体现了 GPU 优化中的一个重要原则：线程数量既不能少到无法隐藏延迟，也没有必要多到每个线程只承担极少工作并产生额外调度压力。

### 10.4 向量加法主要受内存系统限制

向量加法的计算强度很低。每处理一个 `float` 元素，需要大约 12 字节的数据流量，但只有一次浮点加法。

即使增加更多线程，以下总工作量也不会改变：

```text
总读取字节数不变
总写入字节数不变
总浮点加法次数不变
```

当现有线程已经足以隐藏内存访问延迟并使用可用带宽后，再增加线程不会增加显存带宽，也不会减少必须传输的数据量。

因此，对于这种计算量极小、主要受内存访问影响的向量加法，更多线程不一定更快。

## 11. 为什么不能用单次结果下绝对结论

本次结果能够说明 `<<<256,256>>>` 在当前运行中快于 `<<<4096,256>>>`，但不能据此断定它在任何情况下都一定快 1.62 倍。

GPU 测量可能受到以下因素影响：

- 第一次核函数启动和模块加载；
- GPU 当前温度和动态频率；
- 操作系统和其他程序对 GPU 的占用；
- WSL 或驱动调度开销；
- 数据是否已经进入 GPU 缓存；
- CPU 计时器和核函数启动开销；
- 测试次数过少导致的偶然波动。

当前代码设置：

```cpp
int repeat = 10;
```

对于只运行几百微秒的核函数，10 次仍然偏少。第一次核函数启动产生的一次性成本也会被计入平均值。

## 12. 更可靠的测试方法

### 12.1 正式计时前预热

```cpp
for (int i = 0; i < 10; ++i) {
    add_kernel<<<grid_dim, block_dim>>>(d_c, d_a, d_b, SIZE);
}
cudaDeviceSynchronize();
```

预热应放在 `start` 之前，以减少首次启动、模块加载和 GPU 升频对结果的影响。

### 12.2 增加重复次数

可以把：

```cpp
int repeat = 10;
```

增加为：

```cpp
int repeat = 100;
```

快速并行版本也可以使用 1000 次。重复次数越多，单次启动波动对平均时间的影响越小。

### 12.3 多次运行整个程序

每个程序至少运行 5 到 10 次，然后记录：

- 最小值；
- 最大值；
- 平均值；
- 中位数。

通常中位数比单次结果更适合代表典型性能，最小值则更接近系统干扰较少时的性能。

### 12.4 检查 CUDA 错误

核函数启动后应该检查错误：

```cpp
add_kernel<<<grid_dim, block_dim>>>(d_c, d_a, d_b, SIZE);

cudaError_t error = cudaGetLastError();
if (error != cudaSuccess) {
    printf("kernel launch failed: %s\n", cudaGetErrorString(error));
}
```

否则，即使核函数启动失败，程序仍然可能输出一个看似很快但没有意义的时间。

### 12.5 校验完整结果

不能只打印运行时间，还应该检查全部输出元素是否正确：

```cpp
bool correct = true;
for (size_t i = 0; i < SIZE; ++i) {
    if (h_c[i] != 3.0f) {
        correct = false;
        break;
    }
}
```

性能测试的前提是三个版本都完成了相同且正确的计算。

## 13. 核函数时间与端到端时间

本实验只测量核函数时间，没有把以下操作包括在内：

```cpp
cudaMalloc(...)
cudaMemcpy(..., cudaMemcpyHostToDevice)
cudaMemcpy(..., cudaMemcpyDeviceToHost)
```

这样做适合研究不同线程配置对 GPU 核函数的影响。

但是，如果数据最初在 CPU，结果最终也必须返回 CPU，那么实际应用还需要考虑：

```text
CPU 到 GPU 的输入传输
GPU 核函数执行
GPU 到 CPU 的结果传输
```

对于只有一次加法的小任务，PCIe 数据传输时间可能比核函数执行时间更长。此时，即使 GPU 核函数比 CPU 快，包含传输的端到端时间也未必更快。

## 14. 实验结论

本实验得到以下结论：

1. `<<<1,1>>>` 只使用一个 GPU 线程，无法隐藏内存访问延迟，执行 1,048,576 个元素需要约 42 ms。
2. `<<<256,256>>>` 使用 65,536 个线程，每个线程通过 grid-stride loop 处理 16 个元素，执行时间约为 234 μs。
3. `<<<4096,256>>>` 为每个元素分配一个线程，但 4096 个 block 不可能同时运行，执行时间约为 379 μs。
4. 两个并行版本都比单线程版本快超过百倍，说明 GPU 需要足够多的线程来隐藏访存延迟。
5. `<<<256,256>>>` 已经能够提供足够的 block 占用 24 个 SM，增加到 4096 个 block 不一定产生更多有效并行度。
6. 向量加法只有一次浮点加法，却需要两次读取和一次写入，是典型的内存访问受限任务。
7. `-O3` 无法突破内存带宽、访存延迟和调度成本，因此在这组实验中没有带来明显的运行时间变化。
8. “一个元素对应一个线程”是一种简单可靠的写法，但不代表它在所有情况下都是性能最优配置。
9. GPU 优化的目标不是盲目创建最多线程，而是在足够并行度、每线程工作量、内存访问效率和调度成本之间取得平衡。

最重要的结论是：

> 对于这种计算量极小、主要受内存访问影响的向量加法，当线程数量已经足以占满 GPU 后，继续增加线程不会增加内存带宽，反而可能引入更多 block 调度和尾部开销。因此，更多线程不一定更快。
