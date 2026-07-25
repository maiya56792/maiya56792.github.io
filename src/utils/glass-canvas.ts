/**
 * 玻璃雨窗 + 水面 Canvas —— 首屏 hero 的交互层。
 *
 * 画面分区：水面线（waterLineRatio）以上是雾玻璃，以下是水。
 * 分层叠加，从下到上：
 *   1. 背景图（DOM <img>，由 HeroGlass.astro 提供）
 *   2. 水层（本 Canvas）：height-field 双缓冲水波模拟，按高度场梯度对
 *      背景图做折射采样 + 水色着色 + 反光，所以水下的背景天然是模糊变形的
 *   3. 水面线高光（本 Canvas）：一条水平亮带，把「水面」这件事说清楚
 *   4. 雾层（本 Canvas，离屏合成）：半透明白雾，鼠标拂过用 destination-out
 *      擦出通路，擦痕随时间恢复。离屏合成是为了挖洞不会连带把水层擦掉
 *   5. 雨滴与落水闪点（本 Canvas）
 *
 * 水波算法（Hugo Elias height field，与参考实现一致）：
 *   h2[i] = ((左+右+上+下) * 0.5 - h2[i]) * damping
 *   两个缓冲每帧交换，扰动直接往 h1 里注入钟形脉冲（poke）。
 *   模拟跑在降采样网格上（默认 128 宽），再 drawImage 拉伸插值到水区，
 *   全分辨率跑这个双重循环会直接吃掉一帧预算。
 *
 * 透视：网格是「俯视展开的水平面」，绘制时被纵向压扁到水区高度，
 *   所以网格里的正圆涟漪落到屏幕上自动变成椭圆，不需要单独画椭圆。
 *
 * 性能约束：
 *   - 离开视口即暂停 rAF（IntersectionObserver）、页面隐藏暂停
 *   - devicePixelRatio 上限 2
 *   - 低端设备降网格、减雨滴、每帧只推进一步模拟，但不整个关掉
 */

export interface GlassCanvasOptions {
	/** false 时无视系统「减少动画」偏好，强制启动 */
	respectReducedMotion: boolean;
	/** 背景图元素，用于水面折射采样；缺失或跨域读像素失败时自动降级 */
	bgImage?: HTMLImageElement | null;
	fogOpacity: number;
	eraseRadius: number;
	restoreSpeed: number;
	rainEnable: boolean;
	rainCount: number;
	rainSpeed: number;
	rainDropStrength: number;
	rippleEnable: boolean;
	rippleMaxCount: number;
	ripplePointerStrength: number;
	ripplePointerRadius: number;
	waterEnable: boolean;
	waterLineRatio: number;
	waterSimWidth: number;
	waterPerspective: number;
	waterDamping: number;
	waterRefraction: number;
	waterGloss: number;
	waterTint: number;
	waterAmbient: number;
}

/** 雨滴：只在水面线以上下落，触到水面线即消失并激发涟漪 */
interface Drop {
	/** 屏幕坐标 x（CSS px） */
	x: number;
	y: number;
	/** 落点目标 y（水面线附近，带一点随机纵深） */
	ty: number;
	/** 落点对应的模拟网格坐标 */
	sx: number;
	sy: number;
	len: number;
	vy: number;
	alpha: number;
	width: number;
	/** 扰动强度，近景雨滴更强 */
	str: number;
}

/** 落水瞬间的白色小闪点（几何动画，寿命极短，只为强调「叮」的一下） */
interface Plip {
	x: number;
	y: number;
	life: number;
}

const MAX_DPR = 2;
/** 模拟固定步长（秒）：解耦帧率，30Hz 足够表现水波 */
const SIM_STEP = 1 / 30;

export function createGlassCanvas(
	canvas: HTMLCanvasElement,
	opts: GlassCanvasOptions,
): () => void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return () => {};

	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	// 低端判定沿用原逻辑：只用来降规格，不用来关特效
	const lowEnd =
		(navigator.hardwareConcurrency ?? 4) <= 2 ||
		window.matchMedia("(max-width: 640px)").matches;
	if (reduceMotion && opts.respectReducedMotion) return () => {};

	let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
	let w = 0;
	let h = 0;
	let rafId = 0;
	let running = false;

	/** 水面线的屏幕 y（CSS px），resize 时按比例重算 */
	let waterY = 0;
	/** 水区高度（CSS px） */
	let waterH = 0;

	const drops: Drop[] = [];
	const plips: Plip[] = [];
	// 擦除轨迹：记录鼠标经过的点，存活度衰减即雾恢复
	const erases: { x: number; y: number; life: number }[] = [];

	let pointer: { x: number; y: number } | null = null;
	let lastPointer: { x: number; y: number } | null = null;
	/** 上一次注入水面扰动的模拟网格坐标，用来沿路径补点形成连续尾迹 */
	let lastStir: { x: number; y: number } | null = null;

	// 移动端雨滴减半
	const rainCount = lowEnd ? Math.floor(opts.rainCount / 2) : opts.rainCount;
	const plipMax = lowEnd ? 6 : opts.rippleMaxCount;
	// 低端设备每帧最多推进 1 步模拟，桌面最多 2 步（掉帧后追赶）
	const maxSubSteps = lowEnd ? 1 : 2;

	// ---- height field 双缓冲 ----
	let SW = 0;
	let SH = 0;
	let h1 = new Float32Array(0);
	let h2 = new Float32Array(0);
	/** 降采样的背景像素，供折射采样；读像素失败（跨域）时为 null，走纯反光降级 */
	let bgData: ImageData | null = null;
	let outImg: ImageData | null = null;
	const sim = document.createElement("canvas");
	let simCtx: CanvasRenderingContext2D | null = null;
	// 雾层离屏画布：雾单独合成再贴上来，destination-out 挖洞才不会误伤水层
	const fogCv = document.createElement("canvas");
	let fogCtx: CanvasRenderingContext2D | null = null;

	let simT = 0;
	let stepAcc = 0;
	let ambientT = 0;

	/**
	 * 往高度场注入一个钟形脉冲。
	 * 用 cos 衰减而不是常数，避免方形硬边导致的十字状伪影。
	 */
	function poke(cx: number, cy: number, str: number, rad: number) {
		if (!SW || !SH) return;
		const ix = cx | 0;
		const iy = cy | 0;
		const r2 = rad * rad;
		const r0 = Math.ceil(rad);
		for (let y = -r0; y <= r0; y++) {
			for (let x = -r0; x <= r0; x++) {
				const px = ix + x;
				const py = iy + y;
				if (px < 1 || py < 1 || px >= SW - 1 || py >= SH - 1) continue;
				const f = (x * x + y * y) / r2;
				if (f > 1) continue;
				h1[py * SW + px] +=
					str * (0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(f)));
			}
		}
	}

	/**
	 * 水波一步：相邻四点均值减去上一状态，再乘阻尼。
	 * 额外叠两个低频正弦，让水面永远有一点「活着」的起伏，
	 * 否则静止时水面会完全平成一块死板。
	 */
	function stepWater() {
		simT += SIM_STEP;
		const amb = opts.waterAmbient;
		for (let y = 1; y < SH - 1; y++) {
			let i = y * SW + 1;
			for (let x = 1; x < SW - 1; x++, i++) {
				h2[i] =
					((h1[i - 1] + h1[i + 1] + h1[i - SW] + h1[i + SW]) * 0.5 - h2[i]) *
						opts.waterDamping +
					amb * Math.sin(simT * 0.7 + x * 0.05 + y * 0.021) +
					amb * 0.8 * Math.sin(simT * 0.43 - x * 0.023 + y * 0.041);
			}
		}
		const t = h1;
		h1 = h2;
		h2 = t;
	}

	/**
	 * 把高度场渲染成水面像素。
	 * 有 bgData 时：按梯度偏移采样背景，得到折射变形 + 亮暗着色（真水感）。
	 * 无 bgData 时（跨域读像素失败）：只画梯度亮暗的半透明反光层，叠在背景图上。
	 */
	function renderWater() {
		if (!simCtx || !outImg || !SW || !SH) return;
		const dst = outImg.data;
		const src = bgData ? bgData.data : null;
		const hf = h1;
		const refract = opts.waterRefraction;
		const gloss = opts.waterGloss;
		const tint = opts.waterTint;
		// 纯反光模式下把梯度放大成 alpha，CAP 防止亮斑过曝
		const gain = 260;
		const cap = 150;

		for (let y = 0; y < SH; y++) {
			const yu = y > 0 ? y - 1 : y;
			const yd = y < SH - 1 ? y + 1 : y;
			for (let x = 0; x < SW; x++) {
				const i = y * SW + x;
				const xl = x > 0 ? i - 1 : i;
				const xr = x < SW - 1 ? i + 1 : i;
				const gx = hf[xl] - hf[xr];
				const gy = hf[yu * SW + x] - hf[yd * SW + x];
				const di = i * 4;
				if (src) {
					// 折射：沿梯度方向偏移采样点，波峰波谷把背景挤压拉伸
					let sx = (x + gx * refract) | 0;
					let sy = (y + gy * refract) | 0;
					if (sx < 0) sx = 0;
					else if (sx >= SW) sx = SW - 1;
					if (sy < 0) sy = 0;
					else if (sy >= SH) sy = SH - 1;
					const si = (sy * SW + sx) * 4;
					// 纵向梯度当作受光面：朝上的坡面反天光更亮
					const shade = gy * gloss;
					// tint 把水下整体压向冷蓝，蓝通道多留一点，看起来才像水而不是玻璃
					// 只写入梯度产生的亮暗偏移量，alpha 极低，背景图直接透出
					// 避免低分辨率网格放大后的马赛克/重影感
					const bright = Math.max(-80, Math.min(80, shade));
					dst[di] = 180 + bright;
					dst[di + 1] = 210 + bright;
					dst[di + 2] = 240 + bright * 1.2;
					dst[di + 3] = Math.max(0, Math.min(255, Math.abs(bright) * 1.8)) | 0;
				} else {
					let a = gy * gain;
					if (a >= 0) {
						dst[di] = 226;
						dst[di + 1] = 240;
						dst[di + 2] = 255;
						dst[di + 3] = (a > cap ? cap : a) | 0;
					} else {
						a = -a;
						dst[di] = 12;
						dst[di + 1] = 26;
						dst[di + 2] = 52;
						dst[di + 3] = (a > cap ? cap : a) | 0;
					}
				}
			}
		}
		simCtx.putImageData(outImg, 0, 0);

		// 拉伸贴到水区：网格是俯视展开的，纵向压缩即透视，涟漪自动成椭圆
		ctx.save();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		// 拉伸倍数约为 w/SW，blur 半径取其一半，消除低分辨率网格的像素边界
		const blurR = Math.max(1, Math.round((w / SW) * 0.5));
		ctx.filter = `blur(${blurR}px)`;
		ctx.drawImage(sim, 0, waterY, w, waterH);
		ctx.restore();
	}

	/** 水面线：一条水平高光带，明确区分「上面是雾玻璃、下面是水」 */
	function drawWaterLine() {
		ctx.save();
		// 近水面一小段做暗压，模拟水体边缘吸光
		const near = ctx.createLinearGradient(0, waterY - 10, 0, waterY + 26);
		near.addColorStop(0, "rgba(10,24,48,0)");
		near.addColorStop(0.35, `rgba(10,24,48,${0.22 * opts.waterGloss * 0.06})`);
		near.addColorStop(1, "rgba(10,24,48,0)");
		ctx.fillStyle = near;
		ctx.fillRect(0, waterY - 10, w, 36);

		// 高光线本体：中间亮两端淡，避免看起来像一条生硬的 border
		const g = ctx.createLinearGradient(0, 0, w, 0);
		g.addColorStop(0, "rgba(214,234,255,0.12)");
		g.addColorStop(0.45, "rgba(240,249,255,0.62)");
		g.addColorStop(1, "rgba(206,228,252,0.16)");
		ctx.strokeStyle = g;
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(0, waterY + 0.5);
		ctx.lineTo(w, waterY + 0.5);
		ctx.stroke();
		ctx.restore();
	}

	/** 雨滴：只在水面线以上画，落到 ty 时消失并 poke 水面 */
	function drawRain(dt: number) {
		if (!opts.rainEnable) return;
		ctx.save();
		ctx.lineCap = "round";
		for (const d of drops) {
			// 白线画在白雾上不可见，用竖向渐变：头亮尾淡，形成可辨流痕
			const g = ctx.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
			g.addColorStop(0, `rgba(214,229,248,${d.alpha * 0.08})`);
			g.addColorStop(0.7, `rgba(226,240,255,${d.alpha * 0.7})`);
			g.addColorStop(1, `rgba(244,251,255,${d.alpha})`);
			ctx.strokeStyle = g;
			ctx.lineWidth = d.width;
			ctx.beginPath();
			ctx.moveTo(d.x - 0.5, d.y - d.len);
			ctx.lineTo(d.x, d.y);
			ctx.stroke();

			d.y += d.vy * dt * 60;
			if (d.y >= d.ty) {
				// 落水：正脉冲小而尖（水花），负脉冲大而浅（凹陷），合起来像真的砸进去
				if (opts.rippleEnable && opts.waterEnable) {
					poke(d.sx, d.sy, d.str * opts.rainDropStrength, 1.6);
					poke(d.sx, d.sy, -d.str * opts.rainDropStrength * 0.35, 3.4);
				}
				if (plips.length < plipMax) plips.push({ x: d.x, y: d.ty, life: 1 });
				resetDrop(d);
			}
		}
		ctx.restore();
	}

	/** 落水闪点：极短寿命的小白环 + 亮点，强调单颗雨滴的落点 */
	function drawPlips(dt: number) {
		ctx.save();
		for (let i = plips.length - 1; i >= 0; i--) {
			const p = plips[i];
			p.life -= dt / 0.26;
			if (p.life <= 0) {
				plips.splice(i, 1);
				continue;
			}
			const a = p.life;
			// 椭圆环：横轴大于纵轴，和水面透视一致
			ctx.strokeStyle = `rgba(232,244,255,${(0.5 * a).toFixed(3)})`;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.ellipse(
				p.x,
				p.y,
				1.6 + (1 - a) * 11,
				0.6 + (1 - a) * 3.6,
				0,
				0,
				6.2832,
			);
			ctx.stroke();
			ctx.fillStyle = `rgba(240,249,255,${(0.6 * a * a).toFixed(3)})`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, 1.5 * a + 0.3, 0, 6.2832);
			ctx.fill();
		}
		ctx.restore();
	}

	/** 雾层：只覆盖水面线以上（水区靠折射本身就够朦胧，再盖雾会糊成一片） */
	function drawFog() {
		if (!fogCtx) return;
		const fh = fogCv.height / dpr;
		fogCtx.setTransform(1, 0, 0, 1, 0, 0);
		fogCtx.clearRect(0, 0, fogCv.width, fogCv.height);
		fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

		fogCtx.globalCompositeOperation = "source-over";
		const g = fogCtx.createLinearGradient(0, 0, 0, fh);
		g.addColorStop(0, `rgba(228, 238, 250, ${opts.fogOpacity})`);
		g.addColorStop(0.55, `rgba(210, 226, 245, ${opts.fogOpacity * 0.92})`);
		// 贴近水面处雾变淡，让水面线不被雾压住
		g.addColorStop(1, `rgba(196, 216, 240, ${opts.fogOpacity * 0.6})`);
		fogCtx.fillStyle = g;
		fogCtx.fillRect(0, 0, w, fh);

		// 挖洞：destination-out 把雾擦掉，露出下层背景图
		fogCtx.globalCompositeOperation = "destination-out";
		for (const e of erases) {
			const r = opts.eraseRadius * e.life;
			if (r <= 0.5) continue;
			const rg = fogCtx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
			// 边缘羽化，避免硬边像橡皮擦
			rg.addColorStop(0, `rgba(0,0,0,${0.92 * e.life})`);
			rg.addColorStop(0.6, `rgba(0,0,0,${0.5 * e.life})`);
			rg.addColorStop(1, "rgba(0,0,0,0)");
			fogCtx.fillStyle = rg;
			fogCtx.beginPath();
			fogCtx.arc(e.x, e.y, r, 0, Math.PI * 2);
			fogCtx.fill();
		}
		fogCtx.globalCompositeOperation = "source-over";

		ctx.drawImage(fogCv, 0, 0, w, fh);
	}

	/** 随机环境涟漪：偶尔在水面某处冒一个极弱扰动，避免无雨时水面太规律 */
	function ambient(dt: number) {
		if (!opts.waterEnable) return;
		ambientT -= dt;
		if (ambientT > 0) return;
		ambientT = 2.5 + Math.random() * 3;
		poke(
			2 + Math.random() * (SW - 4),
			2 + Math.random() * (SH - 4),
			0.25 + Math.random() * 0.3,
			3,
		);
	}

	/** 屏幕坐标 → 模拟网格坐标；不在水区内返回 null */
	function toSim(px: number, py: number): { x: number; y: number } | null {
		if (!SW || !SH || waterH <= 0) return null;
		if (py < waterY) return null;
		return {
			x: (px / w) * SW,
			y: ((py - waterY) / waterH) * SH,
		};
	}

	/**
	 * 鼠标拂水：沿指针路径注入扰动。
	 * 强度随移动速度增加（拂得快推得开），沿路补点保证快速移动不断线，
	 * 之后靠 damping 自然回弹平复，不需要额外的复原逻辑。
	 */
	function stir(px: number, py: number) {
		if (!opts.waterEnable) return;
		const p = toSim(px, py);
		if (!p) {
			lastStir = null;
			return;
		}
		if (!lastStir) {
			lastStir = { x: p.x, y: p.y };
			return;
		}
		const dx = p.x - lastStir.x;
		const dy = p.y - lastStir.y;
		const d = Math.hypot(dx, dy);
		if (d < 1.1) return;
		const steps = Math.min(8, Math.ceil(d / 1.5));
		const s = Math.min(
			opts.ripplePointerStrength,
			opts.ripplePointerStrength * (0.25 + d * 0.09),
		);
		for (let i = 1; i <= steps; i++) {
			poke(
				lastStir.x + (dx * i) / steps,
				lastStir.y + (dy * i) / steps,
				s,
				opts.ripplePointerRadius,
			);
		}
		lastStir = { x: p.x, y: p.y };
	}

	/** 单颗雨滴复位到水面线以上的随机位置 */
	function resetDrop(d: Drop) {
		// 分层：少数近景雨滴更长更粗更亮，多数远景细而淡，形成景深
		const near = Math.random() < 0.35;
		d.x = Math.random() * w;
		d.len = near ? 26 + Math.random() * 34 : 12 + Math.random() * 20;
		d.y = -d.len - Math.random() * waterY * 0.6;
		// 落点在水面线下方一点随机，模拟远近不同的落水位置
		d.ty = waterY + Math.random() * Math.max(waterH * 0.85, 1);
		const sp = toSim(d.x, d.ty);
		d.sx = sp ? sp.x : SW / 2;
		d.sy = sp ? sp.y : SH / 2;
		d.vy =
			(near ? 1.5 + Math.random() * 1.3 : 0.8 + Math.random() * 1.0) *
			opts.rainSpeed;
		d.alpha = near ? 0.5 + Math.random() * 0.34 : 0.24 + Math.random() * 0.26;
		d.width = near ? 1.4 + Math.random() * 0.8 : 0.8 + Math.random() * 0.5;
		d.str = near ? 1.1 + Math.random() * 0.5 : 0.5 + Math.random() * 0.45;
	}

	function seedRain() {
		drops.length = 0;
		if (!opts.rainEnable) return;
		for (let i = 0; i < rainCount; i++) {
			const d: Drop = {
				x: 0,
				y: 0,
				ty: 0,
				sx: 0,
				sy: 0,
				len: 0,
				vy: 0,
				alpha: 0,
				width: 1,
				str: 1,
			};
			resetDrop(d);
			// 初始随机散布在下落途中，避免开场所有雨滴同时从顶部出现
			d.y = Math.random() * d.ty;
			drops.push(d);
		}
	}

	/** 按当前尺寸建立模拟网格。宽度可配，高度按水区宽高比推算但收在合理范围 */
	function gridFit() {
		const base = lowEnd
			? Math.round(opts.waterSimWidth * 0.65)
			: opts.waterSimWidth;
		SW = Math.max(64, Math.min(256, Math.round(base)));
		// 透视系数：>1 时纵向网格点更少 → 拉伸更明显 → 涟漪更扁
		const ratio = waterH / Math.max(w, 1);
		SH = Math.max(
			32,
			Math.min(
				160,
				Math.round((SW * ratio) / Math.max(opts.waterPerspective, 0.1)),
			),
		);
		sim.width = SW;
		sim.height = SH;
		simCtx = sim.getContext("2d", { willReadFrequently: true });
		h1 = new Float32Array(SW * SH);
		h2 = new Float32Array(SW * SH);
		outImg = simCtx ? simCtx.createImageData(SW, SH) : null;
		stepAcc = 0;
		lastStir = null;
		plips.length = 0;
	}

	/**
	 * 把背景图按 object-fit: cover 的裁剪方式，只取水区那一块降采样到网格，
	 * 作为折射采样源。getImageData 在图片跨域时会抛，捕获后降级为纯反光。
	 */
	function rebuildBg(): void {
		bgData = null;
		const img = opts.bgImage;
		if (!img || !simCtx || !SW || !SH) return;
		const iw = img.naturalWidth;
		const ih = img.naturalHeight;
		if (!iw || !ih || waterH <= 0 || w <= 0 || h <= 0) return;
		// 复算 cover：先算铺满整个 hero 的缩放，再截出水区对应的源矩形
		const scale = Math.max(w / iw, h / ih);
		const visW = w / scale;
		const visH = h / scale;
		const offX = (iw - visW) / 2;
		const offY = (ih - visH) / 2;
		const sy = offY + (waterY / h) * visH;
		const sh = (waterH / h) * visH;
		const tmp = document.createElement("canvas");
		tmp.width = SW;
		tmp.height = SH;
		const tc = tmp.getContext("2d", { willReadFrequently: true });
		if (!tc) return;
		try {
			tc.drawImage(img, offX, sy, visW, sh, 0, 0, SW, SH);
			bgData = tc.getImageData(0, 0, SW, SH);
		} catch {
			bgData = null;
		}
	}

	function resize() {
		const rect = canvas.getBoundingClientRect();
		dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		w = rect.width;
		h = rect.height;
		if (w < 2 || h < 2) return;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		waterY = Math.round(h * opts.waterLineRatio);
		waterH = Math.max(h - waterY, 1);

		// 雾层离屏画布只需覆盖水面线以上
		fogCv.width = Math.round(w * dpr);
		fogCv.height = Math.max(Math.round(waterY * dpr), 1);
		fogCtx = fogCv.getContext("2d");

		gridFit();
		rebuildBg();
		seedRain();
		// 开场先丢几个扰动，首帧就能看到水面在动
		for (let k = 0; k < 3; k++) {
			poke(
				2 + Math.random() * (SW - 4),
				2 + Math.random() * (SH - 4),
				0.6 + Math.random() * 0.6,
				2.4,
			);
		}
	}

	let lastTs = 0;

	function tick(ts: number) {
		if (!running) return;
		const raw = lastTs ? (ts - lastTs) / 1000 : 0.016;
		lastTs = ts;
		// 切回标签页时 dt 会很大，夹住避免模拟一次性炸开
		const dt = Math.min(0.05, raw || 0.016);

		ctx.clearRect(0, 0, w, h);

		// 擦痕沿指针路径补点，保证快速移动时不断线
		if (pointer) {
			if (lastPointer) {
				const dx = pointer.x - lastPointer.x;
				const dy = pointer.y - lastPointer.y;
				const dist = Math.hypot(dx, dy);
				const steps = Math.min(Math.ceil(dist / 12), 12);
				for (let s = 1; s <= steps; s++) {
					erases.push({
						x: lastPointer.x + (dx * s) / steps,
						y: lastPointer.y + (dy * s) / steps,
						life: 1,
					});
				}
			} else {
				erases.push({ x: pointer.x, y: pointer.y, life: 1 });
			}
			stir(pointer.x, pointer.y);
			lastPointer = { ...pointer };
		}

		// 雾恢复：life 衰减到 0 的擦痕移除
		for (let i = erases.length - 1; i >= 0; i--) {
			erases[i].life -= opts.restoreSpeed;
			if (erases[i].life <= 0) erases.splice(i, 1);
		}
		// 上限保护，防止长时间涂抹后数组无限增长拖慢绘制
		if (erases.length > 900) erases.splice(0, erases.length - 900);

		if (opts.waterEnable) {
			ambient(dt);
			// 固定步长推进，掉帧时最多追赶 maxSubSteps 步
			stepAcc += dt;
			let n = 0;
			while (stepAcc >= SIM_STEP && n < maxSubSteps) {
				stepWater();
				stepAcc -= SIM_STEP;
				n++;
			}
			if (stepAcc > SIM_STEP * 4) stepAcc = 0;
			renderWater();
			drawWaterLine();
		}

		drawFog();
		drawRain(dt);
		drawPlips(dt);

		rafId = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		lastTs = 0;
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function onPointerMove(ev: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		pointer = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
	}

	function onPointerLeave() {
		pointer = null;
		lastPointer = null;
		lastStir = null;
	}

	/** 点击：在水面上砸一个较强扰动；点在雾区则只擦雾 */
	function onPointerDown(ev: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		const px = ev.clientX - rect.left;
		const py = ev.clientY - rect.top;
		if (!opts.rippleEnable || !opts.waterEnable) return;
		const p = toSim(px, py);
		if (!p) return;
		lastStir = { x: p.x, y: p.y };
		poke(p.x, p.y, opts.ripplePointerStrength * 3.5, 2.8);
		if (plips.length < plipMax) plips.push({ x: px, y: py, life: 1 });
	}

	function onVisibility() {
		if (document.hidden) stop();
		else start();
	}

	// 离开视口暂停，避免读文章时白耗 GPU 和电量
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) start();
				else stop();
			}
		},
		{ threshold: 0 },
	);

	const ro = new ResizeObserver(() => resize());

	// 背景图可能还没解码完，晚点再重建折射源
	function onBgLoad() {
		rebuildBg();
	}

	resize();
	if (opts.bgImage && !opts.bgImage.complete) {
		opts.bgImage.addEventListener("load", onBgLoad);
	}
	io.observe(canvas);
	ro.observe(canvas);
	canvas.addEventListener("pointermove", onPointerMove, { passive: true });
	canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
	canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
	document.addEventListener("visibilitychange", onVisibility);

	return function destroy() {
		stop();
		io.disconnect();
		ro.disconnect();
		canvas.removeEventListener("pointermove", onPointerMove);
		canvas.removeEventListener("pointerleave", onPointerLeave);
		canvas.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("visibilitychange", onVisibility);
		opts.bgImage?.removeEventListener("load", onBgLoad);
	};
}
